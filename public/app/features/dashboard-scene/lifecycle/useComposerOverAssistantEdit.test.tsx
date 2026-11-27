import { act, renderHook } from '@testing-library/react';

import { config } from '@grafana/runtime';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { appEvents } from 'app/core/app_events';
import {
  type ExtensionSidebarContextType,
  useExtensionSidebarContext,
} from 'app/core/components/AppChrome/ExtensionSidebar/ExtensionSidebarProvider';
import {
  getEffectiveExtensionSidebarPresentation,
  resetExtensionSidebarPresentationForTests,
} from 'app/core/components/AppChrome/ExtensionSidebar/extensionSidebarLayout';
import { OpenExtensionSidebarEvent } from 'app/types/events';

import { addComposerEnterRequestListener, resetComposerEnterRequestsForTests } from '../composer/composerEntryRequests';

import { takeComposerRequestOverAssistantEdit } from './pendingChangesSave';
import { useComposerOverAssistantEdit } from './useComposerOverAssistantEdit';

jest.mock('app/core/components/AppChrome/ExtensionSidebar/ExtensionSidebarProvider', () => ({
  ...jest.requireActual('app/core/components/AppChrome/ExtensionSidebar/ExtensionSidebarProvider'),
  useExtensionSidebarContext: jest.fn(),
}));

jest.mock('./pendingChangesSave', () => ({
  takeComposerRequestOverAssistantEdit: jest.fn(),
}));

const ASSISTANT = 'grafana-assistant-app';
const TITLE = 'Grafana Assistant';
const TARGET = { resource: 'dashboard', uid: 'dash-1' } as const;
const originalAllowList = config.bootData.settings.pluginRestrictedAPIsAllowList;

function sidebarContext(assistant: 'available' | 'loading'): ExtensionSidebarContextType {
  const components =
    assistant === 'available'
      ? new Map([[ASSISTANT, { addedComponents: [{ title: TITLE, targets: [], description: '' }], addedLinks: [] }]])
      : new Map();
  return { dockedComponentId: undefined, availableComponents: components } as unknown as ExtensionSidebarContextType;
}

/** The page asking once: the marker is set for `dash-1` until taken. */
function markRequested() {
  let marked = true;
  jest.mocked(takeComposerRequestOverAssistantEdit).mockImplementation((uid) => {
    const taken = marked && uid === TARGET.uid;
    marked = marked && !taken;
    return taken;
  });
}

let publish: jest.SpyInstance;

beforeEach(() => {
  setTestFlags({ dashboardNewLayouts: true, 'grafana.dashboardPreviewMode': true, 'grafana.dashboardComposer': true });
  // A fresh load with the sidebar closed: Assistant has not registered, but can have the `composer` API.
  config.bootData.settings.pluginRestrictedAPIsAllowList = { composer: [ASSISTANT] };
  publish = jest.spyOn(appEvents, 'publish');
  markRequested();
});

afterEach(() => {
  config.bootData.settings.pluginRestrictedAPIsAllowList = originalAllowList;
  resetComposerEnterRequestsForTests();
  resetExtensionSidebarPresentationForTests();
  setTestFlags({});
  jest.restoreAllMocks();
});

const openedSidebars = () =>
  publish.mock.calls.filter(([event]) => event instanceof OpenExtensionSidebarEvent).map(([event]) => event.payload);

it("opens the closed Assistant sidebar and hands the Assistant's edit to the listener it registers", () => {
  jest.mocked(useExtensionSidebarContext).mockReturnValue(sidebarContext('available'));

  renderHook(() => useComposerOverAssistantEdit(TARGET.uid, true));

  expect(openedSidebars()).toEqual([{ pluginId: ASSISTANT, componentTitle: TITLE }]);
  expect(getEffectiveExtensionSidebarPresentation(ASSISTANT)).toBe('floating');

  const listener = jest.fn();
  let stop = () => {};
  act(() => {
    stop = addComposerEnterRequestListener(listener);
  });
  expect(listener).toHaveBeenCalledTimes(1);
  expect(listener).toHaveBeenCalledWith(TARGET, { assistantEdit: true });
  act(() => stop());
});

it('waits until the sidebar knows the Assistant, then asks once', () => {
  jest.mocked(useExtensionSidebarContext).mockReturnValue(sidebarContext('loading'));
  const { rerender } = renderHook(() => useComposerOverAssistantEdit(TARGET.uid, true));
  expect(openedSidebars()).toEqual([]);

  jest.mocked(useExtensionSidebarContext).mockReturnValue(sidebarContext('available'));
  rerender();
  rerender();

  expect(openedSidebars()).toEqual([{ pluginId: ASSISTANT, componentTitle: TITLE }]);
});

it('asks nothing for a dashboard the page did not open an Assistant edit on', () => {
  jest.mocked(useExtensionSidebarContext).mockReturnValue(sidebarContext('available'));

  renderHook(() => useComposerOverAssistantEdit('other-dashboard', true));

  expect(openedSidebars()).toEqual([]);
});

it('drops the request when the user leaves Editing before the sidebar knows the Assistant', () => {
  jest.mocked(useExtensionSidebarContext).mockReturnValue(sidebarContext('loading'));
  const { rerender } = renderHook(({ isEditing }) => useComposerOverAssistantEdit(TARGET.uid, isEditing), {
    initialProps: { isEditing: true },
  });

  jest.mocked(useExtensionSidebarContext).mockReturnValue(sidebarContext('available'));
  rerender({ isEditing: false });
  // Editing again later is the user's own edit session, not the Assistant's.
  rerender({ isEditing: true });

  expect(openedSidebars()).toEqual([]);
  expect(takeComposerRequestOverAssistantEdit).toHaveBeenCalledWith(TARGET.uid);
});

it('drops the request when the user leaves Editing and comes back while the sidebar is still loading', () => {
  jest.mocked(useExtensionSidebarContext).mockReturnValue(sidebarContext('loading'));
  const { rerender } = renderHook(({ isEditing }) => useComposerOverAssistantEdit(TARGET.uid, isEditing), {
    initialProps: { isEditing: true },
  });
  rerender({ isEditing: false });
  rerender({ isEditing: true });

  jest.mocked(useExtensionSidebarContext).mockReturnValue(sidebarContext('available'));
  rerender({ isEditing: true });

  expect(openedSidebars()).toEqual([]);
});

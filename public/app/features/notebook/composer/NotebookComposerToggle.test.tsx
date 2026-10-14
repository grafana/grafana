import { act, fireEvent, render, screen } from 'test/test-utils';

import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { SceneRefreshPicker, SceneTimePicker, SceneTimeRange } from '@grafana/scenes';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { appEvents } from 'app/core/app_events';
import {
  type ExtensionSidebarContextType,
  useExtensionSidebarContext,
} from 'app/core/components/AppChrome/ExtensionSidebar/ExtensionSidebarProvider';
import {
  getExtensionSidebarPresentation,
  resetExtensionSidebarPresentationForTests,
  setExtensionSidebarPresentation,
} from 'app/core/components/AppChrome/ExtensionSidebar/extensionSidebarLayout';
import { getComponentIdFromComponentMeta } from 'app/core/components/AppChrome/ExtensionSidebar/extensionSidebarUtils';
import { contextSrv } from 'app/core/services/context_srv';
import {
  addComposerEnterRequestListener,
  clearPendingComposerEnterRequest,
  PENDING_REQUEST_TTL_MS,
  wasComposerEnterRequestDocked,
} from 'app/features/dashboard-scene/composer/composerEntryRequests';
import { OpenExtensionSidebarEvent } from 'app/types/events';

import { NOTEBOOKS_FLAG } from '../mutation-api/test-utils';
import { NotebookEmbeddedHost } from '../scene/NotebookEmbeddedContext';
import { NotebookScene } from '../scene/NotebookScene';
import { NotebookCellItem } from '../scene/layout-notebook/NotebookCellItem';
import { NotebookLayoutManager } from '../scene/layout-notebook/NotebookLayoutManager';

import { enterNotebookComposer } from './NotebookComposerDocument';
import { NotebookComposerToggle } from './NotebookComposerToggle';
import { setRouteNotebook } from './notebookComposerAccess';

jest.mock('app/core/components/AppChrome/ExtensionSidebar/ExtensionSidebarProvider', () => ({
  ...jest.requireActual('app/core/components/AppChrome/ExtensionSidebar/ExtensionSidebarProvider'),
  useExtensionSidebarContext: jest.fn(),
}));

setPluginImportUtils({
  importPanelPlugin: () => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: () => undefined,
});

const ASSISTANT = 'grafana-assistant-app';
const TITLE = 'Grafana Assistant';
const TARGET = { resource: 'notebook', uid: 'nb-toggle' };
const cleanups: Array<() => void> = [];

function sidebarContext(assistant: 'available' | 'missing', docked = false): ExtensionSidebarContextType {
  return {
    isOpen: docked,
    dockedComponentId: docked ? getComponentIdFromComponentMeta(ASSISTANT, TITLE) : undefined,
    setDockedComponentId: jest.fn(),
    availableComponents:
      assistant === 'available'
        ? new Map([[ASSISTANT, { addedComponents: [{ title: TITLE, targets: [], description: '' }], addedLinks: [] }]])
        : new Map(),
    extensionSidebarWidth: 300,
    setExtensionSidebarWidth: jest.fn(),
    presentation: 'docked',
  };
}

beforeEach(() => {
  setTestFlags({ [NOTEBOOKS_FLAG]: true, 'grafana.notebookComposer': true });
  jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
  jest.mocked(useExtensionSidebarContext).mockReturnValue(sidebarContext('available'));
});

afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
  clearPendingComposerEnterRequest();
  resetExtensionSidebarPresentationForTests();
  jest.useRealTimers();
  jest.restoreAllMocks();
  setTestFlags({});
});

function notebook() {
  const scene = new NotebookScene({
    title: 'Toggle',
    uid: 'nb-toggle',
    body: new NotebookLayoutManager({
      cells: [
        new NotebookCellItem({
          elementName: 'intro',
          source: 'user',
          content: { kind: 'Markdown', spec: { text: 'Hello' } },
        }),
      ],
    }),
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    timePicker: new SceneTimePicker({}),
    refreshPicker: new SceneRefreshPicker({}),
  });
  cleanups.push(scene.activate());
  cleanups.push(setRouteNotebook(scene));
  return scene;
}

const composerButton = () => screen.queryByRole('button', { name: 'Composer' });

describe('the notebook toolbar Composer toggle', () => {
  it('opens a closed Assistant sidebar already floating and hands the request to Assistant once it listens', async () => {
    const originalPublish = appEvents.publish.bind(appEvents);
    const layoutWhenOpened: string[] = [];
    const publish = jest.spyOn(appEvents, 'publish').mockImplementation((event) => {
      if (event instanceof OpenExtensionSidebarEvent) {
        layoutWhenOpened.push(getExtensionSidebarPresentation());
      }
      originalPublish(event);
    });
    const { user } = render(<NotebookComposerToggle scene={notebook()} />);

    await user.click(composerButton()!);

    const opened = publish.mock.calls
      .map(([event]) => event)
      .filter((event) => event instanceof OpenExtensionSidebarEvent);
    expect(opened.map((event) => event.payload)).toEqual([{ pluginId: ASSISTANT, componentTitle: TITLE }]);
    // The request floats the sidebar before it opens (the floating flag is off here).
    expect(layoutWhenOpened).toEqual(['floating']);
    const listener = jest.fn();
    const unsubscribe = addComposerEnterRequestListener(listener);
    expect(listener).toHaveBeenCalledWith(TARGET);
    expect(getExtensionSidebarPresentation()).toBe('floating');
    unsubscribe();
  });

  it('still hands the request over, docked, when the user docks the sidebar while it waits', async () => {
    const { user } = render(<NotebookComposerToggle scene={notebook()} />);
    await user.click(composerButton()!);

    setExtensionSidebarPresentation('docked');

    expect(getExtensionSidebarPresentation()).toBe('docked');
    expect(wasComposerEnterRequestDocked(TARGET.uid)).toBe(true);
    const listener = jest.fn();
    cleanups.push(addComposerEnterRequestListener(listener));
    expect(listener).toHaveBeenCalledWith(TARGET);
  });

  it('asks a listening Assistant straight away, without entering Composer itself', async () => {
    jest.mocked(useExtensionSidebarContext).mockReturnValue(sidebarContext('available', true));
    const listener = jest.fn();
    cleanups.push(addComposerEnterRequestListener(listener));
    const scene = notebook();
    const { user } = render(<NotebookComposerToggle scene={scene} />);
    await user.click(composerButton()!);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(TARGET);
    expect(scene.state.isComposing).toBeFalsy();
  });

  it('drops a request nobody takes within the pending-request expiry, docking the sidebar again', async () => {
    jest.useFakeTimers();
    render(<NotebookComposerToggle scene={notebook()} />);

    fireEvent.click(composerButton()!);
    expect(getExtensionSidebarPresentation()).toBe('floating');
    act(() => jest.advanceTimersByTime(PENDING_REQUEST_TTL_MS + 1));

    const listener = jest.fn();
    cleanups.push(addComposerEnterRequestListener(listener));
    expect(listener).not.toHaveBeenCalled();
    expect(getExtensionSidebarPresentation()).toBe('docked');
  });

  it('drops a request Assistant has not taken when the notebook goes away', async () => {
    const scene = new NotebookScene({
      title: 'Leaving',
      uid: 'nb-toggle',
      body: new NotebookLayoutManager({ cells: [] }),
      $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
      timePicker: new SceneTimePicker({}),
      refreshPicker: new SceneRefreshPicker({}),
    });
    const deactivate = scene.activate();
    cleanups.push(setRouteNotebook(scene));
    const { user } = render(<NotebookComposerToggle scene={scene} />);
    await user.click(composerButton()!);
    expect(getExtensionSidebarPresentation()).toBe('floating');

    deactivate();

    const listener = jest.fn();
    cleanups.push(addComposerEnterRequestListener(listener));
    expect(listener).not.toHaveBeenCalled();
    expect(getExtensionSidebarPresentation()).toBe('docked');
  });

  it.each([
    ['its toggle is off', () => setTestFlags({ [NOTEBOOKS_FLAG]: true })],
    [
      'Assistant has not registered',
      () => jest.mocked(useExtensionSidebarContext).mockReturnValue(sidebarContext('missing')),
    ],
    ['the user cannot edit notebooks', () => jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false)],
  ])('is hidden while %s', (_, arrange) => {
    arrange();
    render(<NotebookComposerToggle scene={notebook()} />);
    expect(composerButton()).not.toBeInTheDocument();
  });

  it('is hidden where a host such as the Assistant canvas draws the notebook', () => {
    render(
      <NotebookEmbeddedHost>
        <NotebookComposerToggle scene={notebook()} />
      </NotebookEmbeddedHost>
    );
    expect(composerButton()).not.toBeInTheDocument();
  });

  it('shows Composer as on while it is open, and leaves it', async () => {
    const scene = notebook();
    const session = enterNotebookComposer(scene);
    const { user } = render(<NotebookComposerToggle scene={scene} />);

    expect(composerButton()).toHaveAttribute('aria-pressed', 'true');
    await user.click(composerButton()!);

    expect(session.signal.aborted).toBe(true);
    expect(scene.state.isComposing).toBe(false);
  });
});

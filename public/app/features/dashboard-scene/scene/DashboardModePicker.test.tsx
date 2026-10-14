import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestProvider } from 'test/helpers/TestProvider';

import { config, locationService } from '@grafana/runtime';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { appEvents } from 'app/core/app_events';
import {
  type ExtensionSidebarContextType,
  useExtensionSidebarContext,
} from 'app/core/components/AppChrome/ExtensionSidebar/ExtensionSidebarProvider';
import {
  getExtensionSidebarPresentation,
  resetExtensionSidebarPresentationForTests,
} from 'app/core/components/AppChrome/ExtensionSidebar/extensionSidebarLayout';
import { getComponentIdFromComponentMeta } from 'app/core/components/AppChrome/ExtensionSidebar/extensionSidebarUtils';
import { OpenExtensionSidebarEvent } from 'app/types/events';

import { ComposerSession } from '../composer/ComposerSession';
import { canEnterComposer } from '../composer/composerAccess';
import {
  addComposerEnterRequestListener,
  getPendingComposerEnterTarget,
  PENDING_REQUEST_TTL_MS,
  resetComposerEnterRequestsForTests,
} from '../composer/composerEntryRequests';
import { transformSaveModelToScene } from '../serialization/transformSaveModelToScene';

import { DashboardModePicker } from './DashboardModePicker';
import { type DashboardScene } from './DashboardScene';
import { getDashboardMode } from './dashboardModes';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

jest.mock('../saving/createDetectChangesWorker', () => ({
  createWorker: () => ({ postMessage: jest.fn(), terminate: jest.fn(), onmessage: null }),
}));

jest.mock('app/core/components/AppChrome/ExtensionSidebar/ExtensionSidebarProvider', () => ({
  ...jest.requireActual('app/core/components/AppChrome/ExtensionSidebar/ExtensionSidebarProvider'),
  useExtensionSidebarContext: jest.fn(),
}));

jest.mock('../composer/composerAccess', () => ({
  ...jest.requireActual('../composer/composerAccess'),
  canEnterComposer: jest.fn(),
}));

const ASSISTANT = 'grafana-assistant-app';
const TITLE = 'Grafana Assistant';
const FLAGS = { dashboardNewLayouts: true, 'grafana.dashboardPreviewMode': true, 'grafana.dashboardComposer': true };

function sidebarContext(assistant: 'available' | 'missing', docked = false): ExtensionSidebarContextType {
  const assistantId = getComponentIdFromComponentMeta(ASSISTANT, TITLE);
  return {
    isOpen: docked,
    dockedComponentId: docked ? assistantId : undefined,
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

let deactivate = () => {};
/** Assistant listening for entry requests, on dashboards only (registered without options). */
let assistant: jest.Mock;
let stopAssistant = () => {};

beforeEach(() => {
  assistant = jest.fn();
  stopAssistant = addComposerEnterRequestListener(assistant);
  setTestFlags(FLAGS);
  locationService.replace('/d/picker-test');
  jest.mocked(useExtensionSidebarContext).mockReturnValue(sidebarContext('available'));
  jest.mocked(canEnterComposer).mockImplementation(jest.requireActual('../composer/composerAccess').canEnterComposer);
});

afterEach(() => {
  stopAssistant();
  deactivate();
  deactivate = () => {};
  resetComposerEnterRequestsForTests();
  resetExtensionSidebarPresentationForTests();
  setTestFlags({});
  jest.restoreAllMocks();
});

async function openPicker(configure?: (scene: DashboardScene) => void) {
  const scene = transformSaveModelToScene({
    dashboard: {
      title: 'Picker',
      uid: 'picker-test',
      version: 1,
      schemaVersion: 39,
      panels: [],
      annotations: {
        list: [
          {
            builtIn: 1,
            iconColor: 'rgba(0, 211, 255, 1)',
            enable: false,
            hide: true,
            name: 'Annotations & Alerts',
            type: 'dashboard',
            datasource: { uid: '-- Grafana --', type: 'grafana' },
          },
        ],
      },
    },
    meta: { canEdit: true, canSave: true },
  });
  deactivate = scene.activate();
  configure?.(scene);
  render(
    <TestProvider>
      <DashboardModePicker dashboard={scene} />
    </TestProvider>
  );
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Change dashboard mode' }));
  return { scene, user };
}

const composerItem = () => screen.queryByRole('menuitemradio', { name: /Composer/ });

it('offers Composer when its flag is on and Assistant can be shown', async () => {
  await openPicker();
  expect(composerItem()).toBeEnabled();
  expect(composerItem()).toHaveTextContent('Point at panels and regions and ask Assistant to change them.');
});

it('offers Composer while Assistant listens for dashboards, and drops it once nothing does', async () => {
  stopAssistant();
  const notebooksOnly = addComposerEnterRequestListener(jest.fn(), { resources: ['notebook'] });
  await openPicker();
  expect(composerItem()).not.toBeInTheDocument();

  let both = () => {};
  act(() => {
    both = addComposerEnterRequestListener(jest.fn(), { resources: ['dashboard', 'notebook'] });
  });
  expect(composerItem()).toBeEnabled();

  act(() => {
    both();
    notebooksOnly();
  });
  expect(composerItem()).not.toBeInTheDocument();
});

it('keeps the main button the first child of its button group', async () => {
  await openPicker();
  const main = screen.getByRole('button', { name: 'Dashboard mode: Viewing', hidden: true });
  const group = main.parentElement!;
  expect(group.firstElementChild).toBe(main);
  expect([...group.children].every((child) => child.tagName === 'BUTTON')).toBe(true);
});

it("shows Composer with the Assistant sparkle in the Chat button's gradient", async () => {
  await openPicker();
  expect(within(composerItem()!).getByTestId('icon-ai-sparkle')).toBeInTheDocument();
  const gradient = document.getElementById('grafana-assistant-composer-mode-icon-gradient');
  expect(gradient?.tagName.toLowerCase()).toBe('lineargradient');
  expect(gradient?.querySelectorAll('stop')).toHaveLength(2);
});

it('hides Composer when its flag is off', async () => {
  setTestFlags({ ...FLAGS, 'grafana.dashboardComposer': false });
  await openPicker();
  expect(composerItem()).not.toBeInTheDocument();
});

it('hides Composer when Assistant is not available', async () => {
  jest.mocked(useExtensionSidebarContext).mockReturnValue(sidebarContext('missing'));
  await openPicker();
  expect(composerItem()).not.toBeInTheDocument();
});

it.each([
  ['no_permission', 'You need permission to edit this dashboard.'],
  ['unsupported', 'Composer is not available for this dashboard right now.'],
] as const)('shows Composer disabled with the reason when canEnter says %s', async (reason, text) => {
  jest.mocked(canEnterComposer).mockReturnValue({ ok: false, reason });
  await openPicker();
  expect(composerItem()).toBeDisabled();
  expect(composerItem()).toHaveTextContent(text);
  expect(within(composerItem()!).getByTestId('icon-ai-sparkle')).toBeInTheDocument();
});

it('opens a closed Assistant sidebar already floating and hands the request to Assistant', async () => {
  const originalPublish = appEvents.publish.bind(appEvents);
  const layoutWhenOpened: string[] = [];
  const publish = jest.spyOn(appEvents, 'publish').mockImplementation((event) => {
    if (event instanceof OpenExtensionSidebarEvent) {
      layoutWhenOpened.push(getExtensionSidebarPresentation());
    }
    originalPublish(event);
  });
  const { user } = await openPicker();

  await user.click(composerItem()!);

  const opened = publish.mock.calls
    .map(([event]) => event)
    .filter((event) => event instanceof OpenExtensionSidebarEvent);
  expect(opened.map((event) => event.payload)).toEqual([{ pluginId: ASSISTANT, componentTitle: TITLE }]);
  // The request floats the sidebar before it opens (the floating flag is off here), so it never paints docked.
  expect(layoutWhenOpened).toEqual(['floating']);
  expect(assistant).toHaveBeenCalledWith({ resource: 'dashboard', uid: 'picker-test' });
  expect(getExtensionSidebarPresentation()).toBe('floating');
});

it('asks a listening Assistant straight away without reopening its docked sidebar', async () => {
  jest.mocked(useExtensionSidebarContext).mockReturnValue(sidebarContext('available', true));
  const publish = jest.spyOn(appEvents, 'publish');
  const { user, scene } = await openPicker();

  await user.click(composerItem()!);

  expect(assistant).toHaveBeenCalledTimes(1);
  expect(assistant).toHaveBeenCalledWith({ resource: 'dashboard', uid: 'picker-test' });
  expect(publish.mock.calls.some(([event]) => event instanceof OpenExtensionSidebarEvent)).toBe(false);
  // The session, once Assistant enters it, floats the sidebar; the request itself does not.
  expect(getExtensionSidebarPresentation()).toBe('docked');
  // Choosing Composer does not change the mode itself: Assistant enters through the API.
  expect(scene.state.mode).not.toBe('composer');
});

it('ends a request Assistant has not acted on when the dashboard goes away', async () => {
  const { user } = await openPicker();
  await user.click(composerItem()!);
  expect(getExtensionSidebarPresentation()).toBe('floating');

  deactivate();
  deactivate = () => {};

  // The floated sidebar goes back to the user's layout.
  expect(getExtensionSidebarPresentation()).toBe('docked');
  expect(getPendingComposerEnterTarget()).toBeUndefined();
});

// A fresh load with the Assistant sidebar closed: Assistant registers only once one of its roots mounts.
describe('before Assistant first registers', () => {
  const original = {
    restrictedPluginApis: config.featureToggles.restrictedPluginApis,
    allow: config.bootData.settings.pluginRestrictedAPIsAllowList,
  };

  beforeEach(() => {
    stopAssistant();
    resetComposerEnterRequestsForTests();
    config.featureToggles.restrictedPluginApis = true;
    config.bootData.settings.pluginRestrictedAPIsAllowList = { composer: [ASSISTANT] };
  });

  afterEach(() => {
    jest.useRealTimers();
    config.featureToggles.restrictedPluginApis = original.restrictedPluginApis;
    config.bootData.settings.pluginRestrictedAPIsAllowList = original.allow;
  });

  it('offers Composer, and hands the request to the first listener that registers', async () => {
    const { user } = await openPicker();
    expect(composerItem()).toBeEnabled();

    await user.click(composerItem()!);
    expect(getExtensionSidebarPresentation()).toBe('floating');
    expect(getPendingComposerEnterTarget()).toEqual({ resource: 'dashboard', uid: 'picker-test' });

    const listener = jest.fn();
    act(() => {
      stopAssistant = addComposerEnterRequestListener(listener);
    });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ resource: 'dashboard', uid: 'picker-test' });
  });

  it('releases the held request after 10 seconds, docking the sidebar again', async () => {
    await openPicker();
    jest.useFakeTimers();
    fireEvent.click(composerItem()!);
    expect(getExtensionSidebarPresentation()).toBe('floating');

    act(() => jest.advanceTimersByTime(PENDING_REQUEST_TTL_MS));

    expect(getExtensionSidebarPresentation()).toBe('docked');
    expect(getPendingComposerEnterTarget()).toBeUndefined();
  });

  it('does not offer Composer while the composer API is not allowed for Assistant', async () => {
    config.bootData.settings.pluginRestrictedAPIsAllowList = {};
    await openPicker();
    expect(composerItem()).not.toBeInTheDocument();
  });
});

describe('while Composer is active', () => {
  let session: ComposerSession;
  const enterComposer = (dirty: boolean) => (scene: DashboardScene) => {
    session = ComposerSession.enter(scene);
    if (dirty) {
      scene.setState({ isDirty: true, title: 'Unsaved title' });
    }
  };

  it('stays visible, showing Composer with the Assistant sparkle and checked', async () => {
    await openPicker(enterComposer(false));
    const button = screen.getByRole('button', { name: 'Dashboard mode: Composer', hidden: true });
    expect(within(button).getByTestId('icon-ai-sparkle')).toBeInTheDocument();
    expect(button.parentElement!.firstElementChild).toBe(button);
    expect([...button.parentElement!.children].every((child) => child.tagName === 'BUTTON')).toBe(true);
    expect(document.getElementById('grafana-assistant-composer-mode-icon-gradient')).not.toBeNull();
    expect(composerItem()).toBeChecked();
    expect(screen.getByRole('menuitemradio', { name: /Viewing/ })).not.toBeChecked();
  });

  it('does nothing when Composer is chosen again', async () => {
    const { user, scene } = await openPicker(enterComposer(false));

    await user.click(composerItem()!);

    expect(getDashboardMode(scene.state)).toBe('composer');
    expect(session.signal.aborted).toBe(false);
    expect(assistant).not.toHaveBeenCalled();
  });

  it('ends the session and switches to Viewing, keeping unsaved changes', async () => {
    const { user, scene } = await openPicker(enterComposer(true));

    await user.click(screen.getByRole('menuitemradio', { name: /Viewing/ }));

    expect(session.signal.aborted).toBe(true);
    // Viewing with unsaved changes, as leaving Composer presents it.
    expect(getDashboardMode(scene.state)).toBe('agent');
    expect(scene.state.title).toBe('Unsaved title');
    expect(scene.state.isDirty).toBe(true);
  });

  it('ends the session and switches to Editing, keeping unsaved changes', async () => {
    const { user, scene } = await openPicker(enterComposer(true));

    await user.click(screen.getByRole('menuitemradio', { name: /Editing/ }));

    expect(session.signal.aborted).toBe(true);
    expect(getDashboardMode(scene.state)).toBe('edit');
    expect(scene.state.title).toBe('Unsaved title');
    expect(scene.state.isDirty).toBe(true);
  });
});

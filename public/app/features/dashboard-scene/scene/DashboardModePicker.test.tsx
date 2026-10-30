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
  getEffectiveExtensionSidebarPresentation,
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

// The Assistant's sidebar: the plugin that may float.
const sidebarPresentation = () => getEffectiveExtensionSidebarPresentation('grafana-assistant-app');

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
    floatingExtensionSidebarWidth: 480,
    setFloatingExtensionSidebarWidth: jest.fn(),
    presentation: 'docked',
    floatingHidden: false,
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

function renderPicker(configure?: (scene: DashboardScene) => void) {
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
  return { scene, user: userEvent.setup() };
}

async function openPicker(configure?: (scene: DashboardScene) => void) {
  const rendered = renderPicker(configure);
  await rendered.user.click(screen.getByRole('button', { name: 'Change dashboard mode' }));
  return rendered;
}

const composerItem = () => screen.queryByRole('button', { name: 'Composer', hidden: true });

it('offers Composer as a toolbar button with the crosshair when its flag is on and Assistant can be shown', () => {
  renderPicker();
  expect(composerItem()).toBeEnabled();
  expect(composerItem()).toHaveTextContent('');
  expect(within(composerItem()!).getByTestId('icon-crosshair')).toBeInTheDocument();
  expect(composerItem()).toHaveAttribute('aria-pressed', 'false');
});

it('names Composer and describes it in a tooltip on hover', async () => {
  const { user } = renderPicker();
  await user.hover(composerItem()!);
  expect(await screen.findByRole('tooltip')).toHaveTextContent(/^Point at anything and ask the Assistant\.$/);
});

it('places Composer after the mode button group', () => {
  renderPicker();
  const group = screen.getByRole('button', { name: 'Dashboard mode: Viewing' }).parentElement!;
  expect(group.nextElementSibling).toBe(composerItem());
});

it('no longer lists Composer in the mode menu', async () => {
  await openPicker();
  expect(screen.getAllByRole('menuitemradio').map((item) => item.textContent)).toEqual([
    'ViewingView and explore the dashboard.',
    'EditingManually edit panels, layout, and settings.',
  ]);
});

it('offers Composer while Assistant listens for dashboards, and drops it once nothing does', () => {
  stopAssistant();
  const notebooksOnly = addComposerEnterRequestListener(jest.fn(), { resources: ['notebook'] });
  renderPicker();
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

describe('the main button', () => {
  const mainButton = (mode: string) => screen.getByRole('button', { name: `Dashboard mode: ${mode}`, hidden: true });

  it('switches Viewing to Editing while Composer is available, without asking Assistant', async () => {
    const { user, scene } = await openPicker();

    await user.click(mainButton('Viewing'));

    expect(getDashboardMode(scene.state)).toBe('edit');
    expect(assistant).not.toHaveBeenCalled();
  });

  it('switches Viewing to Editing while Composer is off', async () => {
    setTestFlags({ ...FLAGS, 'grafana.dashboardComposer': false });
    const { user, scene } = await openPicker();

    await user.click(mainButton('Viewing'));

    expect(getDashboardMode(scene.state)).toBe('edit');
  });

  it('still switches Editing to Viewing', async () => {
    const { user, scene } = await openPicker((dashboard) => dashboard.setDashboardMode('edit', 'picker'));

    await user.click(mainButton('Editing'));

    expect(getDashboardMode(scene.state)).toBe('view');
  });
});

it('hides Composer when its flag is off', () => {
  setTestFlags({ ...FLAGS, 'grafana.dashboardComposer': false });
  renderPicker();
  expect(composerItem()).not.toBeInTheDocument();
});

it('hides Composer when Assistant is not available', () => {
  jest.mocked(useExtensionSidebarContext).mockReturnValue(sidebarContext('missing'));
  renderPicker();
  expect(composerItem()).not.toBeInTheDocument();
});

it.each([
  ['no_permission', 'You need permission to edit this dashboard.'],
  ['unsupported', 'Composer is not available for this dashboard right now.'],
] as const)('shows Composer disabled with the reason on hover when canEnter says %s', async (reason, text) => {
  jest.mocked(canEnterComposer).mockReturnValue({ ok: false, reason });
  const { user } = renderPicker();
  expect(composerItem()).toBeDisabled();
  await user.hover(composerItem()!);
  expect(await screen.findByRole('tooltip')).toHaveTextContent(text);
});

it('opens a closed Assistant sidebar already floating and hands the request to Assistant', async () => {
  const originalPublish = appEvents.publish.bind(appEvents);
  const layoutWhenOpened: string[] = [];
  const publish = jest.spyOn(appEvents, 'publish').mockImplementation((event) => {
    if (event instanceof OpenExtensionSidebarEvent) {
      layoutWhenOpened.push(sidebarPresentation());
    }
    originalPublish(event);
  });
  const { user } = renderPicker();

  await user.click(composerItem()!);

  const opened = publish.mock.calls
    .map(([event]) => event)
    .filter((event) => event instanceof OpenExtensionSidebarEvent);
  expect(opened.map((event) => event.payload)).toEqual([{ pluginId: ASSISTANT, componentTitle: TITLE }]);
  // The request floats the sidebar before it opens (the floating flag is off here), so it never paints docked.
  expect(layoutWhenOpened).toEqual(['floating']);
  expect(assistant).toHaveBeenCalledWith({ resource: 'dashboard', uid: 'picker-test' });
  expect(sidebarPresentation()).toBe('floating');
});

it('asks a listening Assistant straight away without reopening its docked sidebar', async () => {
  jest.mocked(useExtensionSidebarContext).mockReturnValue(sidebarContext('available', true));
  const publish = jest.spyOn(appEvents, 'publish');
  const { user, scene } = renderPicker();

  await user.click(composerItem()!);

  expect(assistant).toHaveBeenCalledTimes(1);
  expect(assistant).toHaveBeenCalledWith({ resource: 'dashboard', uid: 'picker-test' });
  expect(publish.mock.calls.some(([event]) => event instanceof OpenExtensionSidebarEvent)).toBe(false);
  // The session, once Assistant enters it, floats the sidebar; the request itself does not.
  expect(sidebarPresentation()).toBe('docked');
  // Choosing Composer does not change the mode itself: Assistant enters through the API.
  expect(scene.state.mode).not.toBe('composer');
});

it('ends a request Assistant has not acted on when the dashboard goes away', async () => {
  const { user } = renderPicker();
  await user.click(composerItem()!);
  expect(sidebarPresentation()).toBe('floating');

  deactivate();
  deactivate = () => {};

  // The floated sidebar goes back to the user's layout.
  expect(sidebarPresentation()).toBe('docked');
  expect(getPendingComposerEnterTarget()).toBeUndefined();
});

// A fresh load with the Assistant sidebar closed: Assistant registers only once one of its roots mounts.
describe('before Assistant first registers', () => {
  const original = {
    allow: config.bootData.settings.pluginRestrictedAPIsAllowList,
  };

  beforeEach(() => {
    stopAssistant();
    resetComposerEnterRequestsForTests();
    config.bootData.settings.pluginRestrictedAPIsAllowList = { composer: [ASSISTANT] };
  });

  afterEach(() => {
    jest.useRealTimers();
    config.bootData.settings.pluginRestrictedAPIsAllowList = original.allow;
  });

  it('offers Composer, and hands the request to the first listener that registers', async () => {
    const { user } = renderPicker();
    expect(composerItem()).toBeEnabled();

    await user.click(composerItem()!);
    expect(sidebarPresentation()).toBe('floating');
    expect(getPendingComposerEnterTarget()).toEqual({ resource: 'dashboard', uid: 'picker-test' });

    const listener = jest.fn();
    act(() => {
      stopAssistant = addComposerEnterRequestListener(listener);
    });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ resource: 'dashboard', uid: 'picker-test' });
  });

  it('releases the held request after 10 seconds, docking the sidebar again', () => {
    renderPicker();
    jest.useFakeTimers();
    fireEvent.click(composerItem()!);
    expect(sidebarPresentation()).toBe('floating');

    act(() => jest.advanceTimersByTime(PENDING_REQUEST_TTL_MS));

    expect(sidebarPresentation()).toBe('docked');
    expect(getPendingComposerEnterTarget()).toBeUndefined();
  });

  it('does not offer Composer while the composer API is not allowed for Assistant', () => {
    config.bootData.settings.pluginRestrictedAPIsAllowList = {};
    renderPicker();
    expect(composerItem()).not.toBeInTheDocument();
  });
});

describe('while Composer is active', () => {
  let session: ComposerSession;
  const enterComposer =
    (from: 'view' | 'edit', { dirty = false, paused = false } = {}) =>
    (scene: DashboardScene) => {
      if (from === 'edit') {
        scene.setDashboardMode('edit', 'picker');
      }
      session = ComposerSession.enter(scene);
      if (dirty) {
        scene.setState({ isDirty: true, title: 'Unsaved title' });
      }
      if (paused) {
        session.setPaused(true);
      }
    };
  const mainButton = (mode: string) => screen.getByRole('button', { name: `Dashboard mode: ${mode}`, hidden: true });

  it.each([
    ['view', 'Viewing', 'icon-eye'],
    ['edit', 'Editing', 'icon-pen'],
  ] as const)('over %s, shows the mode it is over and the Composer button pressed', async (from, label, icon) => {
    await openPicker(enterComposer(from));
    const button = mainButton(label);
    expect(within(button).getByTestId(icon)).toBeInTheDocument();
    expect(button.parentElement!.firstElementChild).toBe(button);
    expect(screen.getByRole('menuitemradio', { name: new RegExp(label) })).toBeChecked();
    expect(screen.queryByTestId('icon-ai-sparkle')).not.toBeInTheDocument();
    expect(composerItem()).toHaveAttribute('aria-pressed', 'true');
  });

  it('turns Composer off on a second click, returning to Viewing', async () => {
    const { user, scene } = renderPicker(enterComposer('view'));

    await user.click(composerItem()!);

    expect(session.signal.aborted).toBe(true);
    expect(getDashboardMode(scene.state)).toBe('view');
    expect(composerItem()).toHaveAttribute('aria-pressed', 'false');
    expect(assistant).not.toHaveBeenCalled();
  });

  it('turns Composer off back to Editing when it is over Editing', async () => {
    const { user, scene } = renderPicker(enterComposer('edit', { dirty: true }));

    await user.click(composerItem()!);

    expect(screen.queryByRole('dialog', { name: 'Unsaved changes' })).not.toBeInTheDocument();
    expect(session.signal.aborted).toBe(true);
    expect(getDashboardMode(scene.state)).toBe('edit');
    expect(scene.state.title).toBe('Unsaved title');
  });

  it('asks before turning Composer off while Assistant is running a turn', async () => {
    const { user, scene } = renderPicker(enterComposer('view', { paused: true }));

    await user.click(composerItem()!);
    expect(await screen.findByRole('dialog', { name: 'Leave Composer?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Keep working' }));

    expect(getDashboardMode(scene.state)).toBe('composer');
    expect(session.signal.aborted).toBe(false);
  });

  it('switches to Editing and stays in Composer', async () => {
    const { user, scene } = await openPicker(enterComposer('view'));

    await user.click(screen.getByRole('menuitemradio', { name: /Editing/ }));

    expect(getDashboardMode(scene.state)).toBe('composer');
    expect(scene.state.isEditing).toBe(true);
    expect(session.canWrite).toBe(true);
    expect(session.signal.aborted).toBe(false);
    expect(mainButton('Editing')).toBeInTheDocument();
  });

  it('switches to Viewing without a prompt when nothing is unsaved, and stays in Composer', async () => {
    const { user, scene } = await openPicker(enterComposer('edit'));

    await user.click(screen.getByRole('menuitemradio', { name: /Viewing/ }));

    expect(screen.queryByRole('dialog', { name: 'Unsaved changes' })).not.toBeInTheDocument();
    expect(getDashboardMode(scene.state)).toBe('composer');
    expect(session.canWrite).toBe(false);
    expect(session.signal.aborted).toBe(false);
    expect(mainButton('Viewing')).toBeInTheDocument();
  });

  describe('switching to Viewing with unsaved changes', () => {
    async function chooseViewing() {
      const opened = await openPicker(enterComposer('edit', { dirty: true }));
      await opened.user.click(screen.getByRole('menuitemradio', { name: /Viewing/ }));
      expect(await screen.findByRole('dialog', { name: 'Unsaved changes' })).toBeInTheDocument();
      return opened;
    }

    it('stays in Composer over Editing with the changes when the prompt is cancelled', async () => {
      const { user, scene } = await chooseViewing();

      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(session.canWrite).toBe(true);
      expect(session.signal.aborted).toBe(false);
      expect(scene.state.title).toBe('Unsaved title');
    });

    it('discards the changes and switches Composer to Viewing on Discard', async () => {
      const { user, scene } = await chooseViewing();

      await user.click(screen.getByRole('button', { name: 'Discard' }));

      expect(getDashboardMode(scene.state)).toBe('composer');
      expect(session.canWrite).toBe(false);
      expect(session.signal.aborted).toBe(false);
      expect(scene.state.title).toBe('Picker');
      expect(scene.state.isDirty).toBe(false);
    });
  });

  describe('switching to Viewing while Assistant is running a turn', () => {
    async function chooseViewingMidTurn() {
      const opened = await openPicker(enterComposer('edit', { dirty: true, paused: true }));
      await opened.user.click(screen.getByRole('menuitemradio', { name: /Viewing/ }));
      expect(await screen.findByRole('dialog', { name: 'Switch to Viewing?' })).toBeInTheDocument();
      return opened;
    }

    it('keeps Composer writing when Keep working is chosen', async () => {
      const { user } = await chooseViewingMidTurn();

      await user.click(screen.getByRole('button', { name: 'Keep working' }));

      expect(session.canWrite).toBe(true);
      expect(session.signal.aborted).toBe(false);
    });

    it('stops Composer writing before asking to save or discard, keeping the session', async () => {
      const { user, scene } = await chooseViewingMidTurn();

      await user.click(screen.getByRole('button', { name: 'Stop and switch' }));

      // Assistant stops its turn once Composer can no longer write, whatever the save prompt then does.
      expect(session.canWrite).toBe(false);
      expect(await screen.findByRole('dialog', { name: 'Unsaved changes' })).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Discard' }));
      expect(getDashboardMode(scene.state)).toBe('composer');
      expect(scene.state.title).toBe('Picker');
      expect(session.signal.aborted).toBe(false);
    });
  });
});

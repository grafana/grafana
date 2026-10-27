import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestProvider } from 'test/helpers/TestProvider';

import { locationService } from '@grafana/runtime';
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
import { addComposerEnterRequestListener, clearPendingComposerEnterRequest } from '../composer/composerEntryRequests';
import { transformSaveModelToScene } from '../serialization/transformSaveModelToScene';

import { COMPOSER_SEEN_KEY, DashboardModePicker } from './DashboardModePicker';
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

beforeEach(() => {
  setTestFlags(FLAGS);
  locationService.replace('/d/picker-test');
  jest.mocked(useExtensionSidebarContext).mockReturnValue(sidebarContext('available'));
  jest.mocked(canEnterComposer).mockImplementation(jest.requireActual('../composer/composerAccess').canEnterComposer);
});

afterEach(() => {
  deactivate();
  deactivate = () => {};
  clearPendingComposerEnterRequest();
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
  expect(composerItem()).toHaveTextContent('Point at anything and ask Assistant to change it.');
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

describe('the New badge', () => {
  beforeEach(() => window.localStorage.removeItem(COMPOSER_SEEN_KEY));
  afterEach(() => window.localStorage.removeItem(COMPOSER_SEEN_KEY));

  it('marks Composer as new until Composer has been entered in this browser', async () => {
    const { scene } = await openPicker();
    expect(composerItem()).toHaveTextContent('New');

    act(() => scene.setState({ mode: 'composer' }));
    act(() => scene.setState({ mode: 'view' }));

    expect(composerItem()).not.toHaveTextContent('New');
    expect(window.localStorage.getItem(COMPOSER_SEEN_KEY)).toBe('true');
  });

  it('stays away on later visits', async () => {
    window.localStorage.setItem(COMPOSER_SEEN_KEY, 'true');
    await openPicker();
    expect(composerItem()).not.toHaveTextContent('New');
  });
});

describe('the main button', () => {
  const mainButton = (mode: string) => screen.getByRole('button', { name: `Dashboard mode: ${mode}`, hidden: true });

  it('switches Viewing to Editing while Composer is available, without asking Assistant', async () => {
    const listener = jest.fn();
    const unsubscribe = addComposerEnterRequestListener(listener);
    const { user, scene } = await openPicker();

    await user.click(mainButton('Viewing'));

    expect(getDashboardMode(scene.state)).toBe('edit');
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
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

it('opens a closed Assistant sidebar already floating and hands the request to Assistant once it listens', async () => {
  const originalPublish = appEvents.publish.bind(appEvents);
  const layoutWhenOpened: string[] = [];
  const publish = jest.spyOn(appEvents, 'publish').mockImplementation((event) => {
    if (event instanceof OpenExtensionSidebarEvent) {
      layoutWhenOpened.push(sidebarPresentation());
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
  const listener = jest.fn();
  const unsubscribe = addComposerEnterRequestListener(listener);
  expect(listener).toHaveBeenCalledWith({ resource: 'dashboard', uid: 'picker-test' });
  expect(sidebarPresentation()).toBe('floating');
  unsubscribe();
});

it('asks a listening Assistant straight away without reopening its docked sidebar', async () => {
  jest.mocked(useExtensionSidebarContext).mockReturnValue(sidebarContext('available', true));
  const publish = jest.spyOn(appEvents, 'publish');
  const listener = jest.fn();
  const unsubscribe = addComposerEnterRequestListener(listener);
  const { user, scene } = await openPicker();

  await user.click(composerItem()!);

  expect(listener).toHaveBeenCalledTimes(1);
  expect(listener).toHaveBeenCalledWith({ resource: 'dashboard', uid: 'picker-test' });
  expect(publish.mock.calls.some(([event]) => event instanceof OpenExtensionSidebarEvent)).toBe(false);
  // The session, once Assistant enters it, floats the sidebar; the request itself does not.
  expect(sidebarPresentation()).toBe('docked');
  // Choosing Composer does not change the mode itself: Assistant enters through the API.
  expect(scene.state.mode).not.toBe('composer');
  unsubscribe();
});

it('drops a request Assistant has not taken when the dashboard goes away', async () => {
  const { user } = await openPicker();
  await user.click(composerItem()!);
  expect(sidebarPresentation()).toBe('floating');

  deactivate();
  deactivate = () => {};

  // The floated sidebar goes back to the user's layout.
  expect(sidebarPresentation()).toBe('docked');
  const listener = jest.fn();
  const unsubscribe = addComposerEnterRequestListener(listener);
  expect(listener).not.toHaveBeenCalled();
  unsubscribe();
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
    const listener = jest.fn();
    const unsubscribe = addComposerEnterRequestListener(listener);
    const { user, scene } = await openPicker(enterComposer(false));

    await user.click(composerItem()!);

    expect(getDashboardMode(scene.state)).toBe('composer');
    expect(session.signal.aborted).toBe(false);
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
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

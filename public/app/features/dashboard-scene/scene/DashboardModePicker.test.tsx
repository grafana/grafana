import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestProvider } from 'test/helpers/TestProvider';

import { locationService } from '@grafana/runtime';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { appEvents } from 'app/core/app_events';
import {
  type ExtensionSidebarContextType,
  useExtensionSidebarContext,
} from 'app/core/components/AppChrome/ExtensionSidebar/ExtensionSidebarProvider';
import { getComponentIdFromComponentMeta } from 'app/core/components/AppChrome/ExtensionSidebar/extensionSidebarUtils';
import { OpenExtensionSidebarEvent } from 'app/types/events';

import { canEnterComposer } from '../composer/composerAccess';
import { addComposerEnterRequestListener, clearPendingComposerEnterRequest } from '../composer/composerEntryRequests';
import { transformSaveModelToScene } from '../serialization/transformSaveModelToScene';

import { DashboardModePicker } from './DashboardModePicker';

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
  setTestFlags({});
  jest.restoreAllMocks();
});

async function openPicker() {
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

it('opens a closed Assistant sidebar and hands the request to Assistant once it listens', async () => {
  const publish = jest.spyOn(appEvents, 'publish');
  const { user } = await openPicker();

  await user.click(composerItem()!);

  const opened = publish.mock.calls.map(([event]) => event).find((event) => event instanceof OpenExtensionSidebarEvent);
  expect(opened?.payload).toEqual({ pluginId: ASSISTANT, componentTitle: TITLE });
  const listener = jest.fn();
  const unsubscribe = addComposerEnterRequestListener(listener);
  expect(listener).toHaveBeenCalledWith({ resource: 'dashboard', uid: 'picker-test' });
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
  // Choosing Composer does not change the mode itself: Assistant enters through the API.
  expect(scene.state.mode).not.toBe('composer');
  unsubscribe();
});

it('drops a request Assistant has not taken when the dashboard goes away', async () => {
  const { user } = await openPicker();
  await user.click(composerItem()!);

  deactivate();
  deactivate = () => {};

  const listener = jest.fn();
  const unsubscribe = addComposerEnterRequestListener(listener);
  expect(listener).not.toHaveBeenCalled();
  unsubscribe();
});

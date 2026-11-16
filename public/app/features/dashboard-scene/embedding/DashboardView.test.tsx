import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactElement } from 'react';
import { render as renderWithProviders } from 'test/test-utils';

import { selectors } from '@grafana/e2e-selectors';
import { config, locationService } from '@grafana/runtime';
import { defaultSpec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { getPluginExtensionRegistries } from 'app/features/plugins/extensions/registry/setup';
import { getAppPluginConfigs, getExtensionPointPluginDependencies } from 'app/features/plugins/extensions/utils';
import { DashboardRoutes } from 'app/types/dashboard';

import { getSavedDashboard } from '../lifecycle/lifecycleApi';
import { clearPendingChangePreview, loadPendingChangePreview } from '../lifecycle/pendingChangePreview';
import { provideMutationClientFactory } from '../mutation-api/clientBridge';
import { DashboardScene } from '../scene/DashboardScene';

import { DashboardView } from './DashboardView';

const render = (element: ReactElement) =>
  renderWithProviders(element, {
    historyOptions: { initialEntries: ['/a/grafana-assistant-app/workspace?chat=chat-1'] },
  });

let mockDashboard: DashboardScene;
const reload = jest.fn(async (): Promise<void> => undefined);
const reloadInPlace = jest.fn(async (): Promise<boolean> => true);
const saveDashboard = jest.fn();
const pending = {
  baseGeneration: 0,
  proposed: { ...defaultSpec(), title: 'Draft dashboard' },
  discard: jest.fn(async () => undefined),
  apply: jest.fn(async () => ({ applied: true as const })),
};

jest.mock('../pages/DashboardScenePageStateManager', () => ({
  reloadDashboardInPlace: (...args: unknown[]) => reloadInPlace(...(args as [])),
  UnifiedDashboardScenePageStateManager: jest.fn(() => ({
    get state() {
      return { dashboard: mockDashboard };
    },
    useState: () => ({ dashboard: mockDashboard }),
    loadDashboard: jest.fn(),
    clearState: jest.fn(),
    reloadDashboardFresh: reload,
  })),
}));
jest.mock('app/features/plugins/extensions/registry/setup', () => ({ getPluginExtensionRegistries: jest.fn() }));
jest.mock('app/features/plugins/extensions/utils', () => ({
  getAppPluginConfigs: jest.fn(async () => []),
  getExtensionPointPluginDependencies: jest.fn(),
}));
jest.mock('app/features/plugins/pluginPreloader', () => ({ preloadPlugins: jest.fn(async () => undefined) }));
jest.mock('../lifecycle/lifecycleApi', () => ({
  ...jest.requireActual('../lifecycle/lifecycleApi'),
  getSavedDashboard: jest.fn(),
}));
jest.mock('app/features/manage-dashboards/services/ValidationSrv', () => ({
  validationSrv: { validateNewDashboardName: async () => true },
}));
jest.mock('app/features/browse-dashboards/api/browseDashboardsAPI', () => ({
  ...jest.requireActual('app/features/browse-dashboards/api/browseDashboardsAPI'),
  useSaveDashboardMutation: () => [saveDashboard],
}));

const provisioningEnabled = config.provisioningEnabled;
beforeAll(() => {
  // The embedding test has no app bootstrap or tool execution.
  provideMutationClientFactory(() => () => {});
});
beforeEach(async () => {
  config.provisioningEnabled = false;
  setTestFlags({ 'assistant.dashboard.artifacts': true, dashboardNewLayouts: true });
  pending.baseGeneration = 0;
  pending.discard.mockClear();
  pending.apply.mockClear();
  reload.mockClear();
  saveDashboard.mockReset().mockResolvedValue({
    data: { uid: 'draft-1', url: '/d/draft-1/draft-dashboard', version: 1, status: 'success' },
  });
  jest.mocked(getExtensionPointPluginDependencies).mockResolvedValue(['grafana-assistant-app']);
  jest.mocked(getAppPluginConfigs).mockResolvedValue([]);
  jest.mocked(getPluginExtensionRegistries).mockResolvedValue({
    addedFunctionsRegistry: {
      getState: async () => ({ 'grafana/dashboard/pending-changes/v1': [{ fn: async () => pending }] }),
    },
  } as unknown as Awaited<ReturnType<typeof getPluginExtensionRegistries>>);
  await loadPendingChangePreview('embedded', 'draft-1', 'chat-1');
  mockDashboard = new DashboardScene(
    {
      uid: '',
      title: 'Draft dashboard',
      meta: { isEmbedded: true, canSave: true, newDashboardUid: 'draft-1' },
    },
    'v2'
  );
  mockDashboard.setInitialSaveModel(pending.proposed);
  locationService.push('/a/grafana-assistant-app/workspace?chat=chat-1');
});
afterEach(() => {
  clearPendingChangePreview('draft-1', 'chat-1');
  config.provisioningEnabled = provisioningEnabled;
  setTestFlags({});
  jest.restoreAllMocks();
});

it('loads a newer revision in place and reports each revision it shows', async () => {
  const shown = jest.fn();
  const { rerender } = render(
    <DashboardView uid="draft-1" pendingChanges="chat-1" revision={1} onRevisionShown={shown} />
  );
  await waitFor(() => expect(shown).toHaveBeenCalledWith(1));

  rerender(<DashboardView uid="draft-1" pendingChanges="chat-1" revision={2} onRevisionShown={shown} />);

  await waitFor(() => expect(shown).toHaveBeenLastCalledWith(2));
  expect(reloadInPlace).toHaveBeenCalledWith(expect.anything(), mockDashboard, {
    uid: 'draft-1',
    route: DashboardRoutes.Embedded,
    pendingChanges: 'chat-1',
  });
  expect(reload).not.toHaveBeenCalled();
});

// A fresh load would replace the scene the newer revision is reloading in place.
it('leaves a failed reload of an overtaken revision to the newer one', async () => {
  let failOlder = (_error: Error) => {};
  reloadInPlace.mockImplementationOnce(() => new Promise((_resolve, reject) => (failOlder = reject)));
  const shown = jest.fn();
  const { rerender } = render(
    <DashboardView uid="draft-1" pendingChanges="chat-1" revision={1} onRevisionShown={shown} />
  );
  rerender(<DashboardView uid="draft-1" pendingChanges="chat-1" revision={2} onRevisionShown={shown} />);
  rerender(<DashboardView uid="draft-1" pendingChanges="chat-1" revision={3} onRevisionShown={shown} />);

  await act(async () => failOlder(new Error('offline')));

  await waitFor(() => expect(shown).toHaveBeenLastCalledWith(3));
  expect(reload).not.toHaveBeenCalled();
});

it('opens the native save form and saves the draft without navigating the host', async () => {
  const user = userEvent.setup();
  const changed = jest.fn();
  render(<DashboardView uid="draft-1" pendingChanges="chat-1" onLifecycleChange={changed} />);
  await user.click(await screen.findByRole('button', { name: 'Save' }));
  expect(await screen.findByRole('heading', { name: 'Save dashboard' })).toBeVisible();
  const push = jest.spyOn(locationService, 'push');
  const replace = jest.spyOn(locationService, 'replace');
  // The banner and native drawer both offer Save; use the drawer's public selector.
  await user.click(await screen.findByTestId(selectors.components.Drawer.DashboardSaveDrawer.saveButton));
  await waitFor(() => expect(changed).toHaveBeenCalledWith('saved'));
  expect(saveDashboard).toHaveBeenCalledWith(expect.objectContaining({ create: true, k8s: { name: 'draft-1' } }));
  expect(pending.discard).toHaveBeenCalledTimes(1);
  expect(mockDashboard.state.isEditing).toBe(false);
  expect(locationService.getLocation().pathname).toBe('/a/grafana-assistant-app/workspace');
  expect(push).not.toHaveBeenCalled();
  expect(replace).not.toHaveBeenCalled();
});

it('cancels the save form and leaves the draft in view mode without navigating', async () => {
  const user = userEvent.setup();
  render(<DashboardView uid="draft-1" pendingChanges="chat-1" />);
  await user.click(await screen.findByRole('button', { name: 'Save' }));
  expect(await screen.findByRole('heading', { name: 'Save dashboard' })).toBeVisible();
  const replace = jest.spyOn(locationService, 'replace');
  await user.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(await screen.findByRole('button', { name: 'Save' })).toBeVisible();
  expect(mockDashboard.state.isEditing).toBe(false);
  expect(saveDashboard).not.toHaveBeenCalled();
  expect(pending.discard).not.toHaveBeenCalled();
  expect(replace).not.toHaveBeenCalled();
});

it('returns to the draft when the save drawer is dismissed while it is still loading', async () => {
  const user = userEvent.setup();
  render(<DashboardView uid="draft-1" pendingChanges="chat-1" />);
  expect(await screen.findByRole('button', { name: 'Save' })).toBeVisible();
  act(() => {
    mockDashboard.onEnterEditMode();
    mockDashboard.setState({ loadingView: 'overlay' });
  });
  expect(await screen.findByRole('heading', { name: 'Loading…' })).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Close' }));
  expect(mockDashboard.state.isEditing).toBe(false);
  expect(screen.getByRole('button', { name: 'Save' })).toBeVisible();
  expect(locationService.getLocation().pathname).toBe('/a/grafana-assistant-app/workspace');
});

it('discards a new draft in place and reports completion instead of loading a missing dashboard', async () => {
  const user = userEvent.setup();
  const changed = jest.fn();
  render(<DashboardView uid="draft-1" pendingChanges="chat-1" onLifecycleChange={changed} />);
  await user.click(await screen.findByRole('button', { name: 'Discard' }));
  const dialog = await screen.findByRole('dialog');
  expect(dialog).toHaveTextContent('Discard this draft?');
  await user.click(within(dialog).getByRole('button', { name: 'Discard' }));
  expect(await screen.findByText('Draft discarded')).toBeVisible();
  expect(changed).toHaveBeenCalledWith('discarded');
  expect(pending.discard).toHaveBeenCalledTimes(1);
  expect(reload).not.toHaveBeenCalled();
  expect(locationService.getLocation().pathname).toBe('/a/grafana-assistant-app/workspace');
});

it('shows a different dashboard when the host reuses a view after discarding its draft', async () => {
  const user = userEvent.setup();
  const titleChanged = jest.fn();
  const { rerender } = render(<DashboardView uid="draft-1" pendingChanges="chat-1" onTitleChange={titleChanged} />);
  await user.click(await screen.findByRole('button', { name: 'Discard' }));
  await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Discard' }));
  expect(await screen.findByText('Draft discarded')).toBeVisible();

  mockDashboard = new DashboardScene({ uid: 'saved-2', title: 'Another dashboard', meta: { isEmbedded: true } });
  rerender(<DashboardView uid="saved-2" onTitleChange={titleChanged} />);
  await waitFor(() => expect(titleChanged).toHaveBeenLastCalledWith('Another dashboard'));
  expect(screen.queryByText('Draft discarded')).not.toBeInTheDocument();
});

it.each(['Apply', 'Discard'] as const)(
  '%s reloads pending changes in place before notifying the host',
  async (action) => {
    const user = userEvent.setup();
    let finishReload: () => void = () => {};
    reload.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishReload = resolve;
        })
    );
    pending.baseGeneration = 3;
    mockDashboard.setState({ uid: 'draft-1', meta: { isEmbedded: true, canSave: true } });
    jest.mocked(getSavedDashboard).mockResolvedValue({
      generation: 3,
      title: 'Saved dashboard',
      spec: pending.proposed,
      canEdit: true,
      url: '/d/draft-1',
    });
    const changed = jest.fn();
    render(<DashboardView uid="draft-1" pendingChanges="chat-1" onLifecycleChange={changed} />);
    await user.click(await screen.findByRole('button', { name: action }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeVisible();
    await user.click(within(dialog).getByRole('button', { name: action }));
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(changed).not.toHaveBeenCalled();
    await act(async () => finishReload());
    await waitFor(() => expect(changed).toHaveBeenCalledWith(action === 'Apply' ? 'applied' : 'discarded'));
    if (action === 'Apply') {
      expect(pending.apply).toHaveBeenCalledWith({ force: false });
    } else {
      expect(pending.discard).toHaveBeenCalledTimes(1);
    }
    expect(locationService.getLocation().pathname).toBe('/a/grafana-assistant-app/workspace');
  }
);

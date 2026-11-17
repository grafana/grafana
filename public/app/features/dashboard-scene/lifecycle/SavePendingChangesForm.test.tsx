import { render, screen, waitFor } from 'test/test-utils';

import { defaultSpec, type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { type DashboardWithAccessInfo } from 'app/features/dashboard/api/types';
import { getPluginExtensionRegistries } from 'app/features/plugins/extensions/registry/setup';
import { getAppPluginConfigs, getExtensionPointPluginDependencies } from 'app/features/plugins/extensions/utils';

import { SaveDashboardDrawer } from '../saving/SaveDashboardDrawer';
import { transformSaveModelSchemaV2ToScene } from '../serialization/transformSaveModelSchemaV2ToScene';

import { SavePendingChangesForm } from './SavePendingChangesForm';
import {
  clearPendingChangePreview,
  type DashboardPendingChanges,
  loadPendingChangePreview,
} from './pendingChangePreview';
import { setPendingChangesPageClose } from './pendingChangesPageReload';
import { openPendingChangesForEditing } from './pendingChangesSave';

jest.mock('app/features/plugins/extensions/registry/setup', () => ({ getPluginExtensionRegistries: jest.fn() }));
jest.mock('app/features/plugins/extensions/utils', () => ({
  getAppPluginConfigs: jest.fn(async () => []),
  getExtensionPointPluginDependencies: jest.fn(),
}));
jest.mock('app/features/plugins/pluginPreloader', () => ({ preloadPlugins: jest.fn(async () => undefined) }));

const saved: DashboardV2Spec = { ...defaultSpec(), title: 'Saved' };
const proposed: DashboardV2Spec = { ...defaultSpec(), title: 'Proposed' };
const closePage = jest.fn(async (_uid: string) => undefined);
setPendingChangesPageClose(closePage);

function pendingChanges(overrides: Partial<DashboardPendingChanges> = {}): DashboardPendingChanges {
  return {
    baseGeneration: 3,
    proposed,
    apply: jest.fn(async () => ({ applied: true as const })),
    discard: jest.fn(async () => undefined),
    update: jest.fn(),
    history: {
      record: jest.fn(async () => ({ recorded: true })),
      undo: jest.fn(),
      redo: jest.fn(),
      getState: () => ({}),
      subscribe: () => () => {},
    },
    ...overrides,
  };
}

/** The save form for `pending`, on the page, with the dashboard saved at `savedGeneration` now. */
async function renderForm(pending: DashboardPendingChanges, savedGeneration = 3) {
  jest.mocked(getExtensionPointPluginDependencies).mockResolvedValue(['grafana-assistant-app']);
  jest.mocked(getAppPluginConfigs).mockResolvedValue([]);
  jest.mocked(getPluginExtensionRegistries).mockResolvedValue({
    addedFunctionsRegistry: {
      getState: async () => ({ 'grafana/dashboard/pending-changes/v1': [{ fn: async () => pending }] }),
    },
  } as unknown as Awaited<ReturnType<typeof getPluginExtensionRegistries>>);
  const preview = await loadPendingChangePreview('page', 'dash-1', 'chat-1');
  preview!.saved = { spec: saved, generation: savedGeneration };
  const scene = transformSaveModelSchemaV2ToScene({
    kind: 'DashboardWithAccessInfo',
    apiVersion: 'dashboard.grafana.app/v2beta1',
    metadata: { name: 'dash-1', generation: savedGeneration, resourceVersion: '3', creationTimestamp: '' },
    access: { canEdit: true, canSave: true, canShare: true, canStar: true, canDelete: false, canAdmin: true },
    spec: structuredClone(proposed),
  } as unknown as DashboardWithAccessInfo<DashboardV2Spec>);
  openPendingChangesForEditing(scene);
  const drawer = new SaveDashboardDrawer({ dashboardRef: scene.getRef() });
  return render(<SavePendingChangesForm dashboard={scene} drawer={drawer} changeInfo={scene.getDashboardChanges()} />);
}

beforeEach(() => {
  setTestFlags({ 'assistant.dashboard.artifacts': true, dashboardNewLayouts: true });
  closePage.mockClear();
});

afterEach(() => {
  clearPendingChangePreview('dash-1', 'chat-1');
  setTestFlags({});
});

it('saves the pending changes with the message through their plugin, then shows the saved dashboard', async () => {
  const pending = pendingChanges();
  const { user } = await renderForm(pending);

  await user.type(screen.getByRole('textbox', { name: 'message' }), 'Tidy up');
  await user.click(screen.getByRole('button', { name: 'Save' }));

  await waitFor(() => expect(closePage).toHaveBeenCalledWith('dash-1'));
  expect(pending.apply).toHaveBeenCalledWith({ force: false, message: 'Tidy up' });
});

it('opens on the conflict once someone saved the dashboard since, and saves over their save', async () => {
  const pending = pendingChanges();
  const { user } = await renderForm(pending, 5);

  expect(screen.getByText('Someone else has updated this dashboard')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Save and overwrite' }));

  await waitFor(() => expect(pending.apply).toHaveBeenCalledWith({ force: true, message: '' }));
});

it('asks the plugin to bring stale pending changes up to date instead', async () => {
  const pending = pendingChanges();
  const { user } = await renderForm(pending, 5);

  await user.click(screen.getByRole('button', { name: 'Ask Assistant to update' }));

  expect(pending.update).toHaveBeenCalledTimes(1);
  expect(pending.apply).not.toHaveBeenCalled();
});

it('shows the conflict when the dashboard moved on while the form was open', async () => {
  const pending = pendingChanges({ apply: jest.fn(async () => ({ applied: false as const, currentGeneration: 6 })) });
  const { user } = await renderForm(pending);

  await user.click(screen.getByRole('button', { name: 'Save' }));

  expect(await screen.findByText('Someone else has updated this dashboard')).toBeInTheDocument();
  expect(closePage).not.toHaveBeenCalled();
});

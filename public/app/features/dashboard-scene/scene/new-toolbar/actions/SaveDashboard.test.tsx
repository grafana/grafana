import { act } from 'react';
import { render, screen } from 'test/test-utils';

import { getPanelPlugin } from '@grafana/data/test';
import { selectors } from '@grafana/e2e-selectors';
import { reportInteraction, setPluginImportUtils } from '@grafana/runtime';
import { SceneGridLayout, SceneTimeRange, VizPanel } from '@grafana/scenes';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { contextSrv } from 'app/core/services/context_srv';
import { CustomDashboardTemplateInteractions } from 'app/features/dashboard-scene/analytics/dashboard-templates/main';
import { registerSaveAsTemplateForm } from 'app/features/dashboard-scene/saving/enterprise-components/SaveAsTemplateFormExtension';
import { activateFullSceneTree } from 'app/features/dashboard-scene/utils/test-utils';

import { DashboardScene } from '../../DashboardScene';
import { DashboardGridItem } from '../../layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../../layout-default/DefaultGridLayoutManager';

import { SaveDashboard } from './SaveDashboard';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

jest.mock('app/features/dashboard-scene/analytics/dashboard-templates/main', () => ({
  CustomDashboardTemplateInteractions: {
    saveAsOpened: jest.fn(),
  },
}));

setPluginImportUtils({
  importPanelPlugin: (_id: string) => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: (_id: string) => undefined,
});

interface BuildSceneOpts {
  uid?: string;
  isEditing?: boolean;
  isDirty?: boolean;
  canSave?: boolean;
  canMakeEditable?: boolean;
  isDashboardTemplate?: boolean;
}

function buildTestScene(opts: BuildSceneOpts = {}) {
  const {
    uid = 'dash-1',
    isEditing = true,
    isDirty = false,
    canSave = true,
    canMakeEditable = false,
    isDashboardTemplate = false,
  } = opts;

  const scene = new DashboardScene({
    title: 'Test',
    uid,
    isEditing,
    isDirty,
    meta: {
      canSave,
      canMakeEditable,
      isDashboardTemplate,
    },
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    body: new DefaultGridLayoutManager({
      grid: new SceneGridLayout({
        children: [new DashboardGridItem({ body: new VizPanel({ key: 'panel-1', pluginId: 'text' }) })],
      }),
    }),
  });

  scene.openSaveDrawer = jest.fn();
  activateFullSceneTree(scene);
  return scene;
}

describe('SaveDashboard (toolbar)', () => {
  let originalHasEditPermissionInFolders: boolean;

  beforeEach(() => {
    registerSaveAsTemplateForm(null as unknown as Parameters<typeof registerSaveAsTemplateForm>[0]);
    originalHasEditPermissionInFolders = contextSrv.hasEditPermissionInFolders;
    contextSrv.hasEditPermissionInFolders = true;
  });

  afterEach(async () => {
    registerSaveAsTemplateForm(null as unknown as Parameters<typeof registerSaveAsTemplateForm>[0]);
    contextSrv.hasEditPermissionInFolders = originalHasEditPermissionInFolders;
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await act(async () => {
      setTestFlags({});
    });
  });

  describe('Template edit flow', () => {
    beforeEach(async () => {
      // Wrap in act() because setTestFlags fires OpenFeature events that trigger React state
      // updates while the component is still mounted (RTL cleanup runs in a separate afterEach).
      await act(async () => {
        setTestFlags({ 'grafana.customDashboardTemplates': true });
      });
    });

    afterEach(async () => {
      await act(async () => {
        setTestFlags({});
      });
    });

    it('renders a single Save button without the More options dropdown', async () => {
      const scene = buildTestScene({ isDashboardTemplate: true, canSave: true });
      render(<SaveDashboard dashboard={scene} />);

      const saveBtn = await screen.findByTestId(selectors.components.NavToolbar.editDashboard.saveButton);
      expect(saveBtn).toBeInTheDocument();

      // The template branch renders a single Button, not the ButtonGroup with the dropdown.
      expect(screen.queryByRole('button', { name: /More save options/i })).not.toBeInTheDocument();
    });

    it('calls openSaveDrawer with saveDashboardTemplate when clicked', async () => {
      const scene = buildTestScene({ isDashboardTemplate: true, canSave: true });
      const { user } = render(<SaveDashboard dashboard={scene} />);

      await user.click(await screen.findByTestId(selectors.components.NavToolbar.editDashboard.saveButton));
      expect(scene.openSaveDrawer).toHaveBeenCalledWith({ saveDashboardTemplate: true });
    });

    it('returns null when canSave is false', () => {
      const scene = buildTestScene({ isDashboardTemplate: true, canSave: false });
      const { container } = render(<SaveDashboard dashboard={scene} />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('Save as template menu item', () => {
    afterEach(async () => {
      await act(async () => {
        setTestFlags({});
      });
    });

    it('is hidden when the feature flag is off', async () => {
      await act(async () => {
        setTestFlags({ 'grafana.customDashboardTemplates': false });
      });
      const scene = buildTestScene({ canSave: true });
      const { user } = render(<SaveDashboard dashboard={scene} />);

      await user.click(await screen.findByRole('button', { name: /More save options/i }));
      expect(screen.queryByRole('menuitem', { name: /Save as template/i })).not.toBeInTheDocument();
    });

    it('is hidden when the flag is on but no extension form is registered', async () => {
      await act(async () => {
        setTestFlags({ 'grafana.customDashboardTemplates': true });
      });
      const scene = buildTestScene({ canSave: true });
      const { user } = render(<SaveDashboard dashboard={scene} />);

      await user.click(await screen.findByRole('button', { name: /More save options/i }));
      expect(screen.queryByRole('menuitem', { name: /Save as template/i })).not.toBeInTheDocument();
    });

    it('is visible and triggers openSaveDrawer when flag is on, canSave is true, and an extension form is registered', async () => {
      await act(async () => {
        setTestFlags({ 'grafana.customDashboardTemplates': true });
      });
      registerSaveAsTemplateForm(() => null);

      const scene = buildTestScene({ canSave: true });
      const { user } = render(<SaveDashboard dashboard={scene} />);

      await user.click(await screen.findByRole('button', { name: /More save options/i }));
      const menuItem = await screen.findByRole('menuitem', { name: /Save as template/i });
      await user.click(menuItem);

      expect(scene.openSaveDrawer).toHaveBeenCalledWith({ saveAsDashboardTemplate: true });
    });

    it('fires save_as_opened analytics when the menu item is clicked', async () => {
      await act(async () => {
        setTestFlags({ 'grafana.customDashboardTemplates': true });
      });
      registerSaveAsTemplateForm(() => null);

      const scene = buildTestScene({ canSave: true, uid: 'my-dash' });
      const { user } = render(<SaveDashboard dashboard={scene} />);

      await user.click(await screen.findByRole('button', { name: /More save options/i }));
      await user.click(await screen.findByRole('menuitem', { name: /Save as template/i }));

      expect(CustomDashboardTemplateInteractions.saveAsOpened).toHaveBeenCalledWith({
        dashboardUid: 'my-dash',
      });
    });
  });

  describe('Save as copy', () => {
    it('reports the interaction and opens the drawer in copy mode', async () => {
      const scene = buildTestScene({ canSave: true });
      const { user } = render(<SaveDashboard dashboard={scene} />);

      await user.click(await screen.findByRole('button', { name: /More save options/i }));
      const menuItem = await screen.findByRole('menuitem', { name: /Save as copy/i });
      await user.click(menuItem);

      expect(reportInteraction).toHaveBeenCalledWith('grafana_dashboard_save_as_copy_clicked');
      expect(scene.openSaveDrawer).toHaveBeenCalledWith({ saveAsCopy: true });
    });
  });
});

import { act, render, screen, userEvent } from 'test/test-utils';

import { PANEL_AD_HOC_TRANSFORMATIONS_OWNER } from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import { selectors } from '@grafana/e2e-selectors';
import { setPluginImportUtils } from '@grafana/runtime';
import { VizPanel } from '@grafana/scenes';
import { activateFullSceneTree } from 'app/features/dashboard-scene/utils/test-utils';

import { DashboardScene } from '../DashboardScene';
import { VizPanelHeaderActions } from '../VizPanelHeaderActions';
import { DefaultGridLayoutManager } from '../layout-default/DefaultGridLayoutManager';

import { PanelAdHocChangesAction } from './PanelAdHocChangesAction';

const mockOnSaveDashboard = jest.fn();
jest.mock('../../saving/useSaveDashboard', () => ({
  useSaveDashboard: () => ({ onSaveDashboard: mockOnSaveDashboard }),
}));
// Reloading fetches the saved dashboard from the API and swaps the scene on the page.
const mockReloadedDashboard = { onEnterEditMode: jest.fn() };
const mockPageStateManager = {
  state: { dashboard: undefined as typeof mockReloadedDashboard | undefined },
  removeSceneCache: jest.fn(),
  reloadDashboard: jest.fn(),
};
jest.mock('../../pages/DashboardScenePageStateManager', () => ({
  getDashboardScenePageStateManager: () => mockPageStateManager,
}));

const OWNER = PANEL_AD_HOC_TRANSFORMATIONS_OWNER;
const buttonTestId = selectors.components.Panels.Panel.PanelAdHocChangesHeaderAction;
const promotionPath = jest.fn((dashboard) => dashboard);

setPluginImportUtils({
  importPanelPlugin: () =>
    Promise.resolve(
      getPanelPlugin({ id: 'table' }).setPanelInteractions({
        interactions: [
          {
            id: 0,
            name: 'organize',
            mutates: 'TRANSFORMATION',
            settings: [],
            promotionPath,
          },
        ],
      })
    ),
  getPanelPluginFromCache: () => undefined,
});

interface SceneOptions {
  isEditing?: boolean;
  canSave?: boolean;
  version?: 'v1' | 'v2';
}

async function buildScene({ isEditing = false, canSave = false, version = 'v2' }: SceneOptions = {}) {
  const panel = new VizPanel({
    key: 'panel-1',
    pluginId: 'table',
    headerActions: new VizPanelHeaderActions({}),
  });
  const dashboard = new DashboardScene(
    {
      isEditing,
      meta: { canSave },
      body: DefaultGridLayoutManager.fromVizPanels([panel]),
    },
    version
  );

  activateFullSceneTree(dashboard);
  await act(() => new Promise((r) => setTimeout(r, 1)));

  render(<PanelAdHocChangesAction panel={panel} />);

  return { panel, dashboard };
}

function addAdHocChange(panel: VizPanel) {
  act(() => panel.getRuntimeTransformations().set(OWNER, [{ id: 'organize', options: {} }]));
}

describe('PanelAdHocChangesAction', () => {
  it('shows the button in edit mode when the panel has ad hoc changes', async () => {
    const { panel } = await buildScene({ isEditing: true });

    addAdHocChange(panel);

    expect(screen.getByTestId(buttonTestId)).toHaveTextContent('View changes');
  });

  it('shows the button in view mode when the panel has ad hoc changes', async () => {
    const { panel } = await buildScene({ isEditing: false });

    addAdHocChange(panel);

    expect(screen.getByTestId(buttonTestId)).toHaveTextContent('View changes');
  });

  it('hides the button again when the ad hoc changes are cleared', async () => {
    const { panel } = await buildScene();
    addAdHocChange(panel);
    expect(screen.getByTestId(buttonTestId)).toBeInTheDocument();

    act(() => panel.getRuntimeTransformations().set(OWNER, []));

    expect(screen.queryByTestId(buttonTestId)).not.toBeInTheDocument();
  });

  it('does not show the button when there are no ad hoc changes', async () => {
    await buildScene({ canSave: true });

    expect(screen.queryByTestId(buttonTestId)).not.toBeInTheDocument();
  });

  it('opens a menu with "Save to dashboard" when the user can save a v2 dashboard', async () => {
    const { panel } = await buildScene({ canSave: true });
    addAdHocChange(panel);

    await userEvent.click(screen.getByTestId(buttonTestId));

    expect(await screen.findByRole('menuitem', { name: 'Save to dashboard' })).toBeInTheDocument();
  });

  describe('"Save to dashboard"', () => {
    const promoted = { id: 'organize', options: { excludeByName: { hidden: true } } };

    beforeEach(() => {
      promotionPath.mockReset().mockImplementation((dashboard) => ({ ...dashboard, title: 'Promoted' }));
      mockOnSaveDashboard.mockReset();
      mockReloadedDashboard.onEnterEditMode.mockReset();
      mockPageStateManager.state.dashboard = undefined;
      mockPageStateManager.removeSceneCache.mockReset();
      mockPageStateManager.reloadDashboard.mockReset().mockImplementation(async () => {
        // The page manager must not reuse its cached scene, or it skips rebuilding the dashboard.
        expect(mockPageStateManager.removeSceneCache).toHaveBeenCalledWith('saved-uid');
        mockPageStateManager.state.dashboard = mockReloadedDashboard;
      });
    });

    async function clickSaveToDashboard({ isEditing = false } = {}) {
      const { panel, dashboard } = await buildScene({ canSave: true, isEditing });
      act(() => panel.getRuntimeTransformations().set(OWNER, [promoted]));

      await userEvent.click(screen.getByTestId(buttonTestId));
      await userEvent.click(await screen.findByRole('menuitem', { name: 'Save to dashboard' }));

      return dashboard;
    }

    it('saves the JSON returned by the promotion path, then reloads the saved dashboard uncached', async () => {
      mockOnSaveDashboard.mockResolvedValue({ status: 'success', uid: 'saved-uid' });

      const dashboard = await clickSaveToDashboard();

      expect(promotionPath).toHaveBeenCalledWith(expect.objectContaining({ elements: expect.any(Object) }), {
        elementKey: 'panel-1',
        transformations: [promoted],
      });
      expect(mockOnSaveDashboard).toHaveBeenCalledWith(
        dashboard,
        expect.objectContaining({ rawDashboardJSON: expect.objectContaining({ title: 'Promoted' }) })
      );
      expect(mockPageStateManager.removeSceneCache).toHaveBeenCalledWith('saved-uid');
      expect(mockPageStateManager.reloadDashboard).toHaveBeenCalledTimes(1);
      expect(mockReloadedDashboard.onEnterEditMode).not.toHaveBeenCalled();
    });

    it('puts the reloaded dashboard back in edit mode when it was saved from edit mode', async () => {
      mockOnSaveDashboard.mockResolvedValue({ status: 'success', uid: 'saved-uid' });

      await clickSaveToDashboard({ isEditing: true });

      expect(mockPageStateManager.reloadDashboard).toHaveBeenCalledTimes(1);
      expect(mockReloadedDashboard.onEnterEditMode).toHaveBeenCalledWith('user', 'restore');
    });

    it('does not reload the dashboard when saving fails', async () => {
      mockOnSaveDashboard.mockResolvedValue(new Error('conflict'));

      await clickSaveToDashboard();

      expect(mockOnSaveDashboard).toHaveBeenCalledTimes(1);
      expect(mockPageStateManager.removeSceneCache).not.toHaveBeenCalled();
      expect(mockPageStateManager.reloadDashboard).not.toHaveBeenCalled();
    });
  });

  it.each`
    desc                                     | canSave  | version
    ${'the user cannot save the dashboard'}  | ${false} | ${'v2'}
    ${'the dashboard is v1, even with save'} | ${true}  | ${'v1'}
  `('offers only "Remove changes" when $desc', async ({ canSave, version }) => {
    const { panel } = await buildScene({ canSave, version });
    addAdHocChange(panel);

    await userEvent.click(screen.getByTestId(buttonTestId));

    expect(await screen.findByRole('menuitem', { name: 'Remove changes' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Save to dashboard' })).not.toBeInTheDocument();
  });

  it('clears the panel\'s ad hoc transformations and hides the button when "Remove changes" is clicked', async () => {
    const { panel } = await buildScene();
    addAdHocChange(panel);

    await userEvent.click(screen.getByTestId(buttonTestId));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Remove changes' }));

    expect(panel.getRuntimeTransformations().get(OWNER)).toEqual([]);
    expect(screen.queryByTestId(buttonTestId)).not.toBeInTheDocument();
  });
});

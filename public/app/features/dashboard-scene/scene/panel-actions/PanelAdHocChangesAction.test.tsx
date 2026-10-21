import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { getPanelPlugin } from '@grafana/data/test';
import { selectors } from '@grafana/e2e-selectors';
import { setPluginImportUtils } from '@grafana/runtime';
import { VizPanel } from '@grafana/scenes';
import { activateFullSceneTree } from 'app/features/dashboard-scene/utils/test-utils';

import { DashboardScene } from '../DashboardScene';
import { VizPanelHeaderActions } from '../VizPanelHeaderActions';
import { DefaultGridLayoutManager } from '../layout-default/DefaultGridLayoutManager';

import { PanelAdHocChangesAction } from './PanelAdHocChangesAction';
import { AD_HOC_TRANSFORMATIONS_OWNER } from './promoteAdHocChanges';

const OWNER = AD_HOC_TRANSFORMATIONS_OWNER;
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

  it('runs the panel interaction promotion when "Save to dashboard" is clicked', async () => {
    promotionPath.mockClear();
    const { panel } = await buildScene({ canSave: true });
    addAdHocChange(panel);

    await userEvent.click(screen.getByTestId(buttonTestId));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Save to dashboard' }));

    expect(promotionPath).toHaveBeenCalledTimes(1);
    expect(promotionPath).toHaveBeenCalledWith(expect.objectContaining({ elements: expect.any(Object) }), [
      { id: 'organize', options: {} },
    ]);
  });

  it('does not open a menu when the user cannot save the dashboard', async () => {
    const { panel } = await buildScene({ canSave: false });
    addAdHocChange(panel);

    await userEvent.click(screen.getByTestId(buttonTestId));

    expect(screen.getByTestId(buttonTestId)).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Save to dashboard' })).not.toBeInTheDocument();
  });

  it('does not open a menu on a v1 dashboard, even when the user can save it', async () => {
    const { panel } = await buildScene({ canSave: true, version: 'v1' });
    addAdHocChange(panel);

    await userEvent.click(screen.getByTestId(buttonTestId));

    expect(screen.getByTestId(buttonTestId)).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Save to dashboard' })).not.toBeInTheDocument();
  });
});

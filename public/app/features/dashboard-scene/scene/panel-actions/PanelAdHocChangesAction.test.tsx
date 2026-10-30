import { act, render, screen, userEvent } from 'test/test-utils';

import { getPanelPlugin } from '@grafana/data/test';
import { selectors } from '@grafana/e2e-selectors';
import { setPluginImportUtils } from '@grafana/runtime';
import { VizPanel } from '@grafana/scenes';
import { AnnoKeyManagerKind, ManagerKind } from 'app/features/apiserver/types';
import { activateFullSceneTree } from 'app/features/dashboard-scene/utils/test-utils';
import { TABLE_TRANSFORMATIONS_OWNER } from 'app/features/table/constants';
import { type DashboardMeta } from 'app/types/dashboard';

import { DashboardScene } from '../DashboardScene';
import { LibraryPanelBehavior } from '../LibraryPanelBehavior';
import { VizPanelHeaderActions } from '../VizPanelHeaderActions';
import { DefaultGridLayoutManager } from '../layout-default/DefaultGridLayoutManager';

import { PanelAdHocChangesAction } from './PanelAdHocChangesAction';
import { promotePanelAdHocChanges } from './promote/promotePanelAdHocChanges';

// Promoting the changes is covered by its own tests.
jest.mock('./promote/promotePanelAdHocChanges', () => ({ promotePanelAdHocChanges: jest.fn() }));

const OWNER = TABLE_TRANSFORMATIONS_OWNER;
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
            mutates: ['TRANSFORMATION'],
            schema: [],
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
  meta?: DashboardMeta;
  libraryPanel?: boolean;
}

async function buildScene({
  isEditing = false,
  canSave = false,
  version = 'v2',
  meta = {},
  libraryPanel = false,
}: SceneOptions = {}) {
  const panel = new VizPanel({
    key: 'panel-1',
    pluginId: 'table',
    headerActions: new VizPanelHeaderActions({}),
    // `isLoaded` skips fetching the library panel from the API.
    $behaviors: libraryPanel ? [new LibraryPanelBehavior({ uid: 'lib', name: 'Lib', isLoaded: true })] : [],
  });
  const dashboard = new DashboardScene(
    {
      isEditing,
      meta: { ...meta, canSave },
      body: DefaultGridLayoutManager.fromVizPanels([panel]),
    },
    version
  );
  // Loaded dashboards keep the JSON they were built from.
  dashboard.serializer.initialSaveModel = dashboard.getSaveModel();

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

    expect(screen.getByTestId(buttonTestId)).toHaveTextContent('Changes to view');
  });

  it('shows the button in view mode when the panel has ad hoc changes', async () => {
    const { panel } = await buildScene({ isEditing: false });

    addAdHocChange(panel);

    expect(screen.getByTestId(buttonTestId)).toHaveTextContent('Changes to view');
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

  it('asks the dashboard to save the changes when "Save to dashboard" is clicked', async () => {
    jest.mocked(promotePanelAdHocChanges).mockClear();
    const { panel, dashboard } = await buildScene({ canSave: true });
    addAdHocChange(panel);

    await userEvent.click(screen.getByTestId(buttonTestId));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Save to dashboard' }));

    expect(promotePanelAdHocChanges).toHaveBeenCalledTimes(1);
    expect(promotePanelAdHocChanges).toHaveBeenCalledWith(dashboard, panel);
  });

  it.each([
    { desc: 'the user cannot save the dashboard', options: { canSave: false } },
    { desc: 'the dashboard is v1', options: { canSave: true, version: 'v1' as const } },
    { desc: 'the panel is a library panel', options: { canSave: true, libraryPanel: true } },
  ])('offers only "Remove changes" when $desc', async ({ options }) => {
    const { panel } = await buildScene(options);
    addAdHocChange(panel);

    await userEvent.click(screen.getByTestId(buttonTestId));

    expect(await screen.findByRole('menuitem', { name: 'Remove changes' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Save to dashboard' })).not.toBeInTheDocument();
  });

  // The save drawer shows these dashboards their own save forms.
  it.each([
    { desc: 'provisioned', meta: { provisioned: true } },
    { desc: 'repository-managed', meta: { k8s: { annotations: { [AnnoKeyManagerKind]: ManagerKind.Repo } } } },
  ])('offers "Save to dashboard" when the dashboard is $desc', async ({ meta }) => {
    const { panel } = await buildScene({ canSave: true, meta });
    addAdHocChange(panel);

    await userEvent.click(screen.getByTestId(buttonTestId));

    expect(await screen.findByRole('menuitem', { name: 'Save to dashboard' })).toBeInTheDocument();
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

import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { CustomVariable, SceneVariableSet, VizPanel } from '@grafana/scenes';

import { type SceneQuestion } from '../../questions/types';
import { DashboardScene } from '../../scene/DashboardScene';
import { AutoGridItem } from '../../scene/layout-auto-grid/AutoGridItem';
import { AutoGridLayoutManager } from '../../scene/layout-auto-grid/AutoGridLayoutManager';
import { RowItem } from '../../scene/layout-rows/RowItem';
import { RowsLayoutManager } from '../../scene/layout-rows/RowsLayoutManager';
import { getNextPanelId } from '../../utils/getNextPanelId';
import { activateFullSceneTree } from '../../utils/test-utils';
import { removeVariable } from '../variable/removeVariable';

setPluginImportUtils({
  importPanelPlugin: () => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: () => undefined,
});

function setup() {
  const panels = [1, 2, 3].map((id) => new VizPanel({ key: `panel-${id}`, title: `Panel ${id}`, pluginId: 'table' }));
  const layoutA = new AutoGridLayoutManager({});
  layoutA.state.layout.setState({
    children: [new AutoGridItem({ body: panels[0] }), new AutoGridItem({ body: panels[1] })],
  });
  const layoutB = new AutoGridLayoutManager({});
  layoutB.state.layout.setState({ children: [new AutoGridItem({ body: panels[2] })] });

  const rowQuestions: SceneQuestion[] = [{ text: 'Row question', sources: [{ panelId: 1 }] }];
  const rowA = new RowItem({ title: 'A', layout: layoutA, questions: rowQuestions });
  const rowB = new RowItem({ title: 'B', layout: layoutB });
  const rows = new RowsLayoutManager({ rows: [rowA, rowB] });

  const variable = new CustomVariable({ name: 'env', query: 'a,b' });
  const variables = new SceneVariableSet({ variables: [variable] });
  const dashboardQuestions: SceneQuestion[] = [
    { text: 'Dashboard question', sources: [{ panelId: 2 }, { panelId: 3 }] },
    { text: 'Question without picks' },
  ];
  const dashboard = new DashboardScene({
    isEditing: true,
    body: rows,
    $variables: variables,
    questions: dashboardQuestions,
  });
  const deactivate = activateFullSceneTree(dashboard);

  return {
    dashboard,
    rows,
    rowA,
    rowB,
    layoutA,
    layoutB,
    panels,
    variable,
    variables,
    rowQuestions,
    dashboardQuestions,
    deactivate,
  };
}

describe('removeElement and the panels questions pick', () => {
  let scene: ReturnType<typeof setup>;

  beforeEach(() => {
    scene = setup();
  });

  afterEach(() => scene.deactivate());

  it('drops the pick of a removed panel from the questions on the dashboard', () => {
    scene.layoutA.removePanel(scene.panels[1]);

    expect(scene.dashboard.state.questions).toEqual([
      { text: 'Dashboard question', sources: [{ panelId: 3 }] },
      { text: 'Question without picks' },
    ]);
  });

  it('drops the sources of a question that picked only the removed panel, and leaves other questions as they are', () => {
    scene.layoutA.removePanel(scene.panels[0]);

    expect(scene.rowA.state.questions).toStrictEqual([{ text: 'Row question' }]);
    expect(scene.dashboard.state.questions).toBe(scene.dashboardQuestions);
  });

  it('keeps a question from following a new panel that takes the removed panel ID', () => {
    scene.layoutB.removePanel(scene.panels[2]);

    expect(getNextPanelId(scene.dashboard)).toBe(3);
    expect(scene.dashboard.state.questions?.[0].sources).toEqual([{ panelId: 2 }]);
  });

  it('restores the picks on undo and drops them again on redo', () => {
    const { sidebar } = scene.dashboard.state;

    scene.layoutA.removePanel(scene.panels[1]);
    sidebar.undoAction();

    expect(scene.dashboard.state.questions).toBe(scene.dashboardQuestions);
    expect(scene.layoutA.getVizPanels()).toContain(scene.panels[1]);

    sidebar.redoAction();

    expect(scene.dashboard.state.questions?.[0].sources).toEqual([{ panelId: 3 }]);
    expect(scene.layoutA.getVizPanels()).not.toContain(scene.panels[1]);
  });

  it('drops the picks of every panel in a removed row, and restores them on undo', () => {
    scene.rows.removeRow(scene.rowA);

    expect(scene.dashboard.state.questions).toEqual([
      { text: 'Dashboard question', sources: [{ panelId: 3 }] },
      { text: 'Question without picks' },
    ]);

    scene.dashboard.state.sidebar.undoAction();

    expect(scene.dashboard.state.questions).toBe(scene.dashboardQuestions);
    expect(scene.rows.state.rows).toEqual([scene.rowA, scene.rowB]);
  });

  it('leaves the questions as they are when a variable is removed', () => {
    removeVariable({ source: scene.variables, removedObject: scene.variable });

    expect(scene.dashboard.state.$variables?.state.variables).toEqual([]);
    expect(scene.dashboard.state.questions).toBe(scene.dashboardQuestions);
    expect(scene.rowA.state.questions).toBe(scene.rowQuestions);
  });
});

import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import {
  type MultiValueVariable,
  sceneGraph,
  SceneGridLayout,
  SceneGridRow,
  SceneVariableSet,
  TestVariable,
  VizPanel,
} from '@grafana/scenes';

import { DashboardScene } from '../scene/DashboardScene';
import { AutoGridLayoutManager } from '../scene/layout-auto-grid/AutoGridLayoutManager';
import { DashboardGridItem } from '../scene/layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';
import { RowRepeaterBehavior } from '../scene/layout-default/RowRepeaterBehavior';
import { RowItem } from '../scene/layout-rows/RowItem';
import { performRowRepeats } from '../scene/layout-rows/RowItemRepeater';
import { RowsLayoutManager } from '../scene/layout-rows/RowsLayoutManager';
import { TabItem } from '../scene/layout-tabs/TabItem';
import { performTabRepeats } from '../scene/layout-tabs/TabItemRepeater';
import { TabsLayoutManager } from '../scene/layout-tabs/TabsLayoutManager';
import { getRepeatLocalVariableValue } from '../utils/getRepeatLocalVariableValue';
import { activateFullSceneTree } from '../utils/test-utils';

import { isDashboardRenderReady } from './DashboardRenderReadiness';

setPluginImportUtils({
  importPanelPlugin: () => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: () => undefined,
});

function buildVariable(values = ['A1', 'B1']) {
  return new TestVariable({
    name: 'server',
    query: 'A.*',
    value: values,
    text: values,
    isMulti: true,
    optionsToReturn: ['A1', 'B1', 'C1', 'D1'].map((value) => ({ label: value, value })),
  });
}

function buildRepeatedRow() {
  return new RowItem({
    key: 'row-1',
    title: 'Row $server',
    repeatByVariable: 'server',
    layout: AutoGridLayoutManager.createEmpty(),
  });
}

describe('isDashboardRenderReady', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('waits until v2 row repeats match the current variable values and mount', () => {
    const variable = buildVariable();
    const row = buildRepeatedRow();
    const scene = new DashboardScene({
      $variables: new SceneVariableSet({ variables: [variable] }),
      body: new RowsLayoutManager({ rows: [row] }),
    });

    activateFullSceneTree(scene);
    variable.setState({ loading: false });
    expect(isDashboardRenderReady(scene, new Set())).toBe(false);

    performRowRepeats(variable as unknown as MultiValueVariable, row, false);
    row.state.repeatedRows?.forEach((clone) => activateFullSceneTree(clone));
    expect(isDashboardRenderReady(scene, new Set())).toBe(true);

    variable.changeValueTo(['C1', 'D1']);
    expect(variable.getValue()).toEqual(['C1', 'D1']);
    expect(row.parent?.isActive).toBe(true);
    expect(row.state.repeatByVariable).toBe('server');
    expect(isDashboardRenderReady(scene, new Set())).toBe(false);

    performRowRepeats(variable as unknown as MultiValueVariable, row, false);
    row.state.repeatedRows?.forEach((clone) => activateFullSceneTree(clone));
    expect(isDashboardRenderReady(scene, new Set())).toBe(true);
  });

  it('does not wait forever for a missing repeat variable', () => {
    const row = buildRepeatedRow();
    const scene = new DashboardScene({ body: new RowsLayoutManager({ rows: [row] }) });

    activateFullSceneTree(scene);

    expect(isDashboardRenderReady(scene, new Set())).toBe(true);
  });

  it('waits until repeated tabs match the current variable values and mount', () => {
    const variable = buildVariable();
    const tab = new TabItem({
      key: 'tab-1',
      repeatByVariable: 'server',
      layout: AutoGridLayoutManager.createEmpty(),
    });
    const scene = new DashboardScene({
      $variables: new SceneVariableSet({ variables: [variable] }),
      body: new TabsLayoutManager({ tabs: [tab] }),
    });

    activateFullSceneTree(scene);
    variable.setState({ loading: false });
    expect(isDashboardRenderReady(scene, new Set())).toBe(false);

    performTabRepeats(variable as unknown as MultiValueVariable, tab, false);
    tab.state.repeatedTabs?.forEach((clone) => activateFullSceneTree(clone));

    expect(isDashboardRenderReady(scene, new Set())).toBe(true);
  });

  it('waits until repeated panels mount and render', () => {
    const variable = buildVariable();
    const item = new DashboardGridItem({
      key: 'grid-item-1',
      variableName: 'server',
      body: new VizPanel({ key: 'panel-1', pluginId: 'text' }),
    });
    const scene = new DashboardScene({
      $variables: new SceneVariableSet({ variables: [variable] }),
      body: DefaultGridLayoutManager.fromGridItems([item]),
    });
    jest.spyOn(sceneGraph, 'hasVariableDependencyInLoadingState').mockReturnValue(false);

    activateFullSceneTree(scene);
    variable.setState({ loading: false });
    item.performRepeat();
    item.state.repeatedPanels?.forEach((panel) => {
      if (!panel.isActive) {
        panel.activate();
      }
    });

    const panels = [item.state.body, ...(item.state.repeatedPanels ?? [])];
    const renderedPanelKeys = new Set(panels.map((panel) => panel.state.key!));
    expect(panels.map((panel) => getRepeatLocalVariableValue(panel, 'server'))).toEqual(['A1', 'B1']);
    expect(panels.every((panel) => panel.isActive)).toBe(true);
    expect(isDashboardRenderReady(scene, new Set())).toBe(false);
    expect(isDashboardRenderReady(scene, renderedPanelKeys)).toBe(true);
  });

  it('waits for default v1 row repeats', () => {
    const variable = buildVariable();
    const repeater = new RowRepeaterBehavior({ variableName: 'server' });
    const row = new SceneGridRow({ key: 'row-1', children: [], $behaviors: [repeater] });
    const scene = new DashboardScene({
      $variables: new SceneVariableSet({ variables: [variable] }),
      body: new DefaultGridLayoutManager({ grid: new SceneGridLayout({ children: [row] }) }),
    });
    const dependencySpy = jest.spyOn(sceneGraph, 'hasVariableDependencyInLoadingState').mockReturnValue(true);

    activateFullSceneTree(scene);
    variable.setState({ loading: false });
    expect(isDashboardRenderReady(scene, new Set())).toBe(false);

    dependencySpy.mockReturnValue(false);
    repeater.performRepeat();
    repeater.getRepeatedRows()?.forEach((repeatedRow) => {
      if (!repeatedRow.isActive) {
        repeatedRow.activate();
      }
    });

    expect(repeater.isRepeatComplete()).toBe(true);
    expect(isDashboardRenderReady(scene, new Set())).toBe(true);
  });

  it('requires every active panel to complete a render', () => {
    const panel = new VizPanel({ key: 'panel-1', pluginId: 'text' });
    const scene = new DashboardScene({ body: DefaultGridLayoutManager.fromVizPanels([panel]) });

    activateFullSceneTree(scene);

    expect(isDashboardRenderReady(scene, new Set())).toBe(false);
    expect(isDashboardRenderReady(scene, new Set(['panel-1']))).toBe(true);
  });
});

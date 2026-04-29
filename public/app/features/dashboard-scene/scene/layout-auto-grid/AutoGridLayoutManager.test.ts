import {
  ConstantVariable,
  CustomVariable,
  SceneGridLayout,
  SceneQueryRunner,
  SceneVariableSet,
  SwitchVariable,
  VizPanel,
} from '@grafana/scenes';

import { ConditionalRenderingVariable } from '../../conditional-rendering/conditions/ConditionalRenderingVariable';
import { ConditionalRenderingGroup } from '../../conditional-rendering/group/ConditionalRenderingGroup';
import { DashboardEditActionEvent } from '../../edit-pane/shared';
import { getQueryRunnerFor } from '../../utils/utils';
import { DashboardScene, type DashboardSceneState } from '../DashboardScene';
import { DashboardGridItem } from '../layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../layout-default/DefaultGridLayoutManager';

import { AutoGridItem } from './AutoGridItem';
import { AutoGridLayout } from './AutoGridLayout';
import { AutoGridLayoutManager } from './AutoGridLayoutManager';

describe('AutoGridLayoutManager', () => {
  describe('removePanel', () => {
    it('can remove panel', () => {
      const { manager, panel1 } = setup();

      manager.subscribeToEvent(DashboardEditActionEvent, (event) => {
        event.payload.perform();
      });

      manager.removePanel(panel1);

      expect(manager.state.layout.state.children.length).toBe(1);
    });
  });

  describe('duplicate', () => {
    it('returns a new AutoGridLayoutManager instance', () => {
      const { manager } = setup();

      const duplicated = manager.duplicate() as AutoGridLayoutManager;

      expect(duplicated).toBeInstanceOf(AutoGridLayoutManager);
      expect(duplicated).not.toBe(manager);
      expect(duplicated.state.key).not.toBe(manager.state.key);
    });

    it('deep-clones all children', () => {
      const { manager, gridItems } = setup();

      const duplicated = manager.duplicate() as AutoGridLayoutManager;

      const clonedChildren = duplicated.state.layout.state.children;

      expect(clonedChildren.length).toBe(2);

      expect(clonedChildren[0]).not.toBe(gridItems[0]);
      expect(clonedChildren[0].state.body).not.toBe(gridItems[0].state.body);

      expect(clonedChildren[1]).not.toBe(gridItems[1]);
      expect(clonedChildren[1].state.body).not.toBe(gridItems[1].state.body);
    });

    describe('when grid items contain panels', () => {
      it('assigns unique sequential panel keys, starting after the highest existing id', () => {
        const { manager } = setup();

        const duplicated = manager.duplicate() as AutoGridLayoutManager;

        const panelKeys = duplicated.getVizPanels().map((p) => p.state.key);
        expect(panelKeys).toEqual(['panel-3', 'panel-4']);
      });
    });
  });
  describe('createFromLayout', () => {
    it('preserves panel pluginId, title and options when creating from DefaultGridLayoutManager', () => {
      const defaultLayout = setupSceneWithDefaultGrid([getDefaultVizPanel()]);

      const autoLayout = AutoGridLayoutManager.createFromLayout(defaultLayout);

      const children = autoLayout.state.layout.state.children;
      expect(children).toHaveLength(1);
      const panel = (children[0] as AutoGridItem).state.body;
      expect(panel.state.pluginId).toBe(panelPluginId);
      expect(panel.state.title).toBe(panelTitle);
      expect(panel.state.options).toEqual(panelOptions);
    });

    it('preserves panel queries when creating from DefaultGridLayoutManager', () => {
      const defaultLayout = setupSceneWithDefaultGrid([getDefaultVizPanel()]);

      const autoLayout = AutoGridLayoutManager.createFromLayout(defaultLayout);

      const children = autoLayout.state.layout.state.children;
      const panel = (children[0] as AutoGridItem).state.body;
      const runner = getQueryRunnerFor(panel);
      expect(runner).toBeDefined();
      expect(runner?.state.queries).toEqual(queries);
    });

    it('preserves order of panels when creating AutoGridLayoutManager from DefaultGridLayoutManager', () => {
      const panelA = new VizPanel({ key: 'panel-a', title: 'Panel A', pluginId: 'table' });
      const panelB = new VizPanel({ key: 'panel-b', title: 'Panel B', pluginId: 'timeseries' });
      const panelC = new VizPanel({ key: 'panel-c', title: 'Panel C', pluginId: 'stat' });

      const layout = setupSceneWithDefaultGrid([panelA, panelB, panelC]);

      const autoLayout = AutoGridLayoutManager.createFromLayout(layout);

      const children = autoLayout.state.layout.state.children;
      expect(children).toHaveLength(3);
      expect(children[0]).toBeInstanceOf(AutoGridItem);
      expect(children[1]).toBeInstanceOf(AutoGridItem);
      expect(children[2]).toBeInstanceOf(AutoGridItem);
      expect((children[0] as AutoGridItem).state.body.state.title).toBe('Panel A');
      expect((children[1] as AutoGridItem).state.body.state.title).toBe('Panel B');
      expect((children[2] as AutoGridItem).state.body.state.title).toBe('Panel C');
    });

    it('preserves repeat variable (variableName) when creating AutoGridLayoutManager from DefaultGridLayoutManager', () => {
      const variableName = 'myRepeatVar';

      const dashboard = new DashboardScene({
        body: new DefaultGridLayoutManager({
          grid: new SceneGridLayout({
            children: [
              new DashboardGridItem({
                key: 'gi-1',
                x: 0,
                y: 0,
                width: 8,
                height: 6,
                body: getDefaultVizPanel(),
                variableName,
              }),
            ],
          }),
        }),
      });

      const autoLayout = AutoGridLayoutManager.createFromLayout(dashboard.state.body);

      const children = autoLayout.state.layout.state.children;
      expect(children).toHaveLength(1);
      expect(children[0]).toBeInstanceOf(AutoGridItem);
      expect((children[0] as AutoGridItem).state.variableName).toBe(variableName);
    });

    it('does not set variableName when DashboardGridItem has no repeat variable', () => {
      const layout = setupSceneWithDefaultGrid([getDefaultVizPanel()]);

      const autoLayout = AutoGridLayoutManager.createFromLayout(layout);

      const children = autoLayout.state.layout.state.children;
      expect(children).toHaveLength(1);
      expect((children[0] as AutoGridItem).state.variableName).toBeUndefined();
    });

    it('clones panels and does not reuse original panel instances', () => {
      const panelA = new VizPanel({ key: 'panel-a', title: 'Panel A', pluginId: 'table' });
      const panelB = new VizPanel({ key: 'panel-b', title: 'Panel B', pluginId: 'timeseries' });

      const layout = setupSceneWithDefaultGrid([panelA, panelB]);

      const autoLayout = AutoGridLayoutManager.createFromLayout(layout);

      const children = autoLayout.state.layout.state.children;
      const clonedBodyA = (children[0] as AutoGridItem).state.body;
      const clonedBodyB = (children[1] as AutoGridItem).state.body;

      expect(clonedBodyA).not.toBe(panelA);
      expect(clonedBodyB).not.toBe(panelB);
      expect(clonedBodyA.state.title).toBe(panelA.state.title);
      expect(clonedBodyB.state.title).toBe(panelB.state.title);
    });

    it('sets isDraggable to true when dashboard is in edit mode', () => {
      const layout = setupSceneWithDefaultGrid([getDefaultVizPanel()], { isEditing: true });

      const autoLayout = AutoGridLayoutManager.createFromLayout(layout);

      expect(autoLayout.state.layout.state.isDraggable).toBe(true);
    });

    it('sets isDraggable to false when dashboard is not in edit mode', () => {
      const layout = setupSceneWithDefaultGrid([getDefaultVizPanel()], { isEditing: false });

      const autoLayout = AutoGridLayoutManager.createFromLayout(layout);

      expect(autoLayout.state.layout.state.isDraggable).toBe(false);
    });
  });
});

describe('AutoGridItem repeat + conditional rendering', () => {
  function createGroupWithVariableEquals(variable: string, value: string): ConditionalRenderingGroup {
    const condition = new ConditionalRenderingVariable({
      variable,
      operator: '=',
      value,
      result: undefined,
    });

    return new ConditionalRenderingGroup({
      condition: 'and',
      visibility: 'show',
      conditions: [condition],
      result: true,
      renderHidden: false,
    });
  }

  function setupDashboardWithAutoGridItem({
    repeatByValues,
    conditionalGroup,
  }: {
    repeatByValues: boolean;
    conditionalGroup: ConditionalRenderingGroup;
  }) {
    const valuesVar = new CustomVariable({
      name: 'Values',
      query: 'Value1,Value2',
      options: [
        { label: 'Value1', value: 'Value1' },
        { label: 'Value2', value: 'Value2' },
      ],
      value: ['Value1', 'Value2'],
      text: ['Value1', 'Value2'],
      isMulti: true,
    });

    const hideVar = new SwitchVariable({
      name: 'Hide',
      value: 'false',
      enabledValue: 'true',
      disabledValue: 'false',
    });

    const regionVar = new ConstantVariable({
      name: 'Region',
      value: 'US',
    });

    const variables = new SceneVariableSet({
      variables: [valuesVar, hideVar, regionVar],
    });

    const panel = new VizPanel({
      title: 'Panel 1',
      key: 'panel-1',
      pluginId: 'table',
      $data: new SceneQueryRunner({ key: 'data-query-runner', queries: [{ refId: 'A' }] }),
    });

    const gridItem = new AutoGridItem({
      key: 'grid-item-1',
      body: panel,
      variableName: repeatByValues ? 'Values' : undefined,
      conditionalRendering: conditionalGroup,
    });

    const manager = new AutoGridLayoutManager({
      key: 'test-AutoGridLayoutManager',
      layout: new AutoGridLayout({ children: [gridItem] }),
    });

    const dashboard = new DashboardScene({ body: manager, $variables: variables });

    // Activate the dashboard and create repeat clones for the tests.
    dashboard.activate();
    gridItem.performRepeat();

    return { gridItem, valuesVar, hideVar, regionVar };
  }

  it('repeated panel respects conditional rendering based on non-repeat variable', () => {
    const group = createGroupWithVariableEquals('Hide', 'false');
    const { gridItem, hideVar } = setupDashboardWithAutoGridItem({ repeatByValues: true, conditionalGroup: group });

    // Hide = false -> visible
    hideVar.setState({ value: 'false' });
    gridItem.state.conditionalRendering?.forceCheck();
    gridItem.state.repeatedConditionalRendering?.forEach((g) => g.forceCheck());
    expect(gridItem.state.repeatedConditionalRendering?.every((g) => g.state.result)).toBe(true);

    // Hide = true -> hidden
    hideVar.setState({ value: 'true' });
    gridItem.state.conditionalRendering?.forceCheck();
    gridItem.state.repeatedConditionalRendering?.forEach((g) => g.forceCheck());
    expect(gridItem.state.repeatedConditionalRendering?.every((g) => g.state.result === false)).toBe(true);

    // Hide = false again -> visible
    hideVar.setState({ value: 'false' });
    gridItem.state.conditionalRendering?.forceCheck();
    gridItem.state.repeatedConditionalRendering?.forEach((g) => g.forceCheck());
    expect(gridItem.state.repeatedConditionalRendering?.every((g) => g.state.result)).toBe(true);
  });

  it('non-repeated panel conditional rendering still works correctly after fix', () => {
    const group = createGroupWithVariableEquals('Hide', 'false');
    const { gridItem, hideVar } = setupDashboardWithAutoGridItem({ repeatByValues: false, conditionalGroup: group });

    hideVar.setState({ value: 'false' });
    gridItem.state.conditionalRendering?.forceCheck();
    expect(gridItem.state.conditionalRendering?.state.result).toBe(true);

    hideVar.setState({ value: 'true' });
    gridItem.state.conditionalRendering?.forceCheck();
    expect(gridItem.state.conditionalRendering?.state.result).toBe(false);
  });

  it('repeated panel can use its own repeat variable in conditional rendering', () => {
    const group = createGroupWithVariableEquals('Values', 'Value1');
    const { gridItem } = setupDashboardWithAutoGridItem({ repeatByValues: true, conditionalGroup: group });

    gridItem.state.conditionalRendering?.forceCheck();
    gridItem.state.repeatedConditionalRendering?.forEach((g) => g.forceCheck());

    // Source panel should resolve Values=Value1, clone should resolve Values=Value2.
    expect(gridItem.state.conditionalRendering?.state.result).toBe(true);
    expect(gridItem.state.repeatedConditionalRendering).toHaveLength(1);
    expect(gridItem.state.repeatedConditionalRendering?.[0].state.result).toBe(false);
  });

  it('repeated panel with multiple conditional rendering conditions evaluates all correctly', () => {
    const hideCondition = new ConditionalRenderingVariable({
      variable: 'Hide',
      operator: '=',
      value: 'false',
      result: undefined,
    });
    const regionCondition = new ConditionalRenderingVariable({
      variable: 'Region',
      operator: '=',
      value: 'US',
      result: undefined,
    });

    const group = new ConditionalRenderingGroup({
      condition: 'and',
      visibility: 'show',
      conditions: [hideCondition, regionCondition],
      result: true,
      renderHidden: false,
    });

    const { gridItem, hideVar, regionVar } = setupDashboardWithAutoGridItem({
      repeatByValues: true,
      conditionalGroup: group,
    });

    const force = () => {
      gridItem.state.conditionalRendering?.forceCheck();
      gridItem.state.repeatedConditionalRendering?.forEach((g) => g.forceCheck());
    };

    // Hide=false + Region=US: visible
    hideVar.setState({ value: 'false' });
    regionVar.setState({ value: 'US' });
    force();
    expect(gridItem.state.repeatedConditionalRendering?.every((g) => g.state.result)).toBe(true);

    // Hide=true + Region=US: hidden
    hideVar.setState({ value: 'true' });
    regionVar.setState({ value: 'US' });
    force();
    expect(gridItem.state.repeatedConditionalRendering?.every((g) => g.state.result === false)).toBe(true);

    // Hide=false + Region=EU: hidden
    hideVar.setState({ value: 'false' });
    regionVar.setState({ value: 'EU' });
    force();
    expect(gridItem.state.repeatedConditionalRendering?.every((g) => g.state.result === false)).toBe(true);

    // Hide=true + Region=EU: hidden
    hideVar.setState({ value: 'true' });
    regionVar.setState({ value: 'EU' });
    force();
    expect(gridItem.state.repeatedConditionalRendering?.every((g) => g.state.result === false)).toBe(true);
  });

  it('repeated panel resolves variable from intermediate ancestor before reaching dashboard root', () => {
    const valuesVar = new CustomVariable({
      name: 'Values',
      query: 'Value1,Value2',
      options: [
        { label: 'Value1', value: 'Value1' },
        { label: 'Value2', value: 'Value2' },
      ],
      value: ['Value1', 'Value2'],
      text: ['Value1', 'Value2'],
      isMulti: true,
    });

    const hideVar = new SwitchVariable({
      name: 'Hide',
      value: 'false',
      enabledValue: 'true',
      disabledValue: 'false',
    });

    const middleVariables = new SceneVariableSet({ variables: [hideVar] });

    const group = createGroupWithVariableEquals('Hide', 'false');

    const panel = new VizPanel({
      title: 'Panel 1',
      key: 'panel-1',
      pluginId: 'table',
      $data: new SceneQueryRunner({ key: 'data-query-runner', queries: [{ refId: 'A' }] }),
    });

    const gridItem = new AutoGridItem({
      key: 'grid-item-1',
      body: panel,
      variableName: 'Values',
      conditionalRendering: group,
    });

    // Simulate a row/tab level $variables scope sitting between the clone and the dashboard root.
    const middleLayout = new AutoGridLayout({ children: [gridItem], $variables: middleVariables });

    const manager = new AutoGridLayoutManager({
      key: 'test-AutoGridLayoutManager',
      layout: middleLayout,
    });

    // Dashboard root intentionally does NOT define Hide to verify the intermediate scope is used.
    const dashboard = new DashboardScene({
      body: manager,
      $variables: new SceneVariableSet({ variables: [valuesVar] }),
    });

    dashboard.activate();
    gridItem.performRepeat();

    gridItem.state.conditionalRendering?.forceCheck();
    gridItem.state.repeatedConditionalRendering?.forEach((g) => g.forceCheck());
    expect(gridItem.state.repeatedConditionalRendering?.every((g) => g.state.result)).toBe(true);

    // Flip Hide -> should hide repeated clones.
    hideVar.setState({ value: 'true' });
    gridItem.state.conditionalRendering?.forceCheck();
    gridItem.state.repeatedConditionalRendering?.forEach((g) => g.forceCheck());
    expect(gridItem.state.repeatedConditionalRendering?.every((g) => g.state.result === false)).toBe(true);
  });
});

export function setup() {
  const panel1 = new VizPanel({
    title: 'Panel A',
    key: 'panel-1',
    pluginId: 'table',
    $data: new SceneQueryRunner({ key: 'data-query-runner', queries: [{ refId: 'A' }] }),
  });

  const panel2 = new VizPanel({
    title: 'Panel A',
    key: 'panel-2',
    pluginId: 'table',
    $data: new SceneQueryRunner({ key: 'data-query-runner', queries: [{ refId: 'A' }] }),
  });

  const gridItems = [
    new AutoGridItem({
      key: 'grid-item-1',
      body: panel1,
    }),
    new AutoGridItem({
      key: 'grid-item-2',
      body: new VizPanel({
        title: 'Panel B',
        key: 'panel-2',
        pluginId: 'table',
      }),
    }),
  ];

  const manager = new AutoGridLayoutManager({
    key: 'test-AutoGridLayoutManager',
    layout: new AutoGridLayout({ children: gridItems }),
  });

  new DashboardScene({ body: manager });

  return { manager, gridItems, panel1, panel2 };
}

const panelOptions = { legend: { displayMode: 'list', placement: 'bottom' } };
const panelTitle = 'Test panel';
const panelPluginId = 'timeseries';
const queries = [{ refId: 'A', datasource: { type: 'test', uid: 'ds1' } }];

const getDefaultVizPanel = () =>
  new VizPanel({
    key: 'panel-1',
    pluginId: panelPluginId,
    title: panelTitle,
    options: panelOptions,
    $data: new SceneQueryRunner({ key: 'test', queries }),
  });

const setupSceneWithDefaultGrid = (panels: VizPanel[], sceneOptions?: Partial<DashboardSceneState>) => {
  const dashboard = new DashboardScene({
    ...sceneOptions,
    body: new DefaultGridLayoutManager({
      grid: new SceneGridLayout({
        children: panels.map(
          (panel, index) =>
            new DashboardGridItem({ key: `gi-${index + 1}`, x: 0, y: 0, width: 8, height: 6, body: panel })
        ),
      }),
    }),
  });
  return dashboard.state.body;
};

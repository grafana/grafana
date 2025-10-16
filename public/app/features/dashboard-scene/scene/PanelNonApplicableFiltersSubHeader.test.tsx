import { getPanelPlugin } from '@grafana/data/test';
import {
  AdHocFiltersVariable,
  GroupByVariable,
  SceneFlexItem,
  SceneFlexLayout,
  SceneQueryRunner,
  SceneTimeRange,
  SceneVariableSet,
  VizPanel,
} from '@grafana/scenes';

import { activateFullSceneTree } from '../utils/test-utils';

import { PanelNonApplicableFiltersSubHeader } from './PanelNonApplicableFiltersSubHeader';
import { DefaultGridLayoutManager } from './layout-default/DefaultGridLayoutManager';
import { DashboardScene } from './DashboardScene';

describe('PanelNonApplicableFiltersSubHeader', () => {
  it('should throw error when not used with VizPanel', () => {
    const subHeader = new PanelNonApplicableFiltersSubHeader();
    const scene = new SceneFlexLayout({
      children: [new SceneFlexItem({ body: subHeader })],
    });

    expect(() => activateFullSceneTree(scene)).toThrow(
      'PanelNonApplicableFiltersSubHeader can be used only for VizPanel'
    );
  });

  it('should get AdHocFiltersVariable correctly', () => {
    const adHocVariable = new AdHocFiltersVariable({
      name: 'filters',
      applyMode: 'manual',
      filters: [],
    });

    const subHeader = new PanelNonApplicableFiltersSubHeader();
    buildTestPanel(subHeader, adHocVariable);

    const result = subHeader.getAdHocFiltersVariable();
    expect(result).toBe(adHocVariable);
  });

  it('should get GroupByVariable correctly', () => {
    const groupByVariable = new GroupByVariable({
      name: 'groupBy',
      value: [],
    });

    const subHeader = new PanelNonApplicableFiltersSubHeader();
    buildTestPanel(subHeader, undefined, groupByVariable);

    const result = subHeader.getGroupByVariable();
    expect(result).toBe(groupByVariable);
  });

  it('should return undefined when AdHocFiltersVariable is not present', () => {
    const subHeader = new PanelNonApplicableFiltersSubHeader();
    buildTestPanel(subHeader);

    const result = subHeader.getAdHocFiltersVariable();
    expect(result).toBeUndefined();
  });

  it('should return undefined when GroupByVariable is not present', () => {
    const subHeader = new PanelNonApplicableFiltersSubHeader();
    buildTestPanel(subHeader);

    const result = subHeader.getGroupByVariable();
    expect(result).toBeUndefined();
  });

  it('should get both AdHocFiltersVariable and GroupByVariable when both are present', () => {
    const adHocVariable = new AdHocFiltersVariable({
      name: 'filters',
      applyMode: 'manual',
      filters: [],
    });

    const groupByVariable = new GroupByVariable({
      name: 'groupBy',
      value: [],
    });

    const subHeader = new PanelNonApplicableFiltersSubHeader();
    buildTestPanel(subHeader, adHocVariable, groupByVariable);

    expect(subHeader.getAdHocFiltersVariable()).toBe(adHocVariable);
    expect(subHeader.getGroupByVariable()).toBe(groupByVariable);
  });
});

function buildTestPanel(
  subHeader: PanelNonApplicableFiltersSubHeader,
  adHocVariable?: AdHocFiltersVariable,
  groupByVariable?: GroupByVariable
): VizPanel {
  const variables = [];
  if (adHocVariable) {
    variables.push(adHocVariable);
  }
  if (groupByVariable) {
    variables.push(groupByVariable);
  }

  const panel = new VizPanel({
    title: 'Test Panel',
    pluginId: 'table',
    subHeaderContent: subHeader,
    $data: new SceneQueryRunner({
      datasource: { uid: 'test-ds' },
      queries: [{ refId: 'A' }],
    }),
  });

  panel.getPlugin = () => getPanelPlugin({ skipDataQuery: false });

  const scene = new DashboardScene({
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    $variables: new SceneVariableSet({ variables }),
    body: DefaultGridLayoutManager.fromVizPanels([panel]),
  });

  // Activate just the scene and variables
  scene.activate();
  if (scene.state.$variables) {
    scene.state.$variables.activate();
  }

  // Activate subHeader
  subHeader.activate();

  return panel;
}

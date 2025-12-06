import { DataSourceSrv, setDataSourceSrv } from '@grafana/runtime';
import {
  AdHocFiltersVariable,
  GroupByVariable,
  SceneTimeRange,
  SceneVariable,
  SceneVariableSet,
} from '@grafana/scenes';

import { DataSourceGetRecommendedDrilldownsOptions } from '../../../../../packages/grafana-data/src/types/datasource';

import { DashboardScene } from './DashboardScene';
import { RecommendedDrilldownsBehavior } from './RecommendedDrilldownsBehavior';

describe('RecommendedDrilldownsBehavior', () => {
  it('should not get recommended drilldowns if recommendations are disabled', async () => {
    const { getRecommendedDrilldownsSpy } = await setup({ enableRecommendations: false });
    expect(getRecommendedDrilldownsSpy).not.toHaveBeenCalled();
  });

  it('should not get recommended drilldowns if dashboard does not have uid', async () => {
    const { getRecommendedDrilldownsSpy } = await setup({ hasDashboardUid: false });
    expect(getRecommendedDrilldownsSpy).not.toHaveBeenCalled();
  });

  it('should not get recommended drilldowns if dashboard has no adHoc or groupBy', async () => {
    const { getRecommendedDrilldownsSpy } = await setup({ noVars: true });
    expect(getRecommendedDrilldownsSpy).not.toHaveBeenCalled();
  });

  it('should get recommended drilldowns on adhoc and groupby var', async () => {
    const { filtersVar, groupByVar, getRecommendedDrilldownsSpy } = await setup({});
    expect(getRecommendedDrilldownsSpy).toHaveBeenCalled();

    expect(filtersVar.state._recommendedFilters).toBeDefined();
    expect(filtersVar.state._recommendedFilters).toHaveLength(4);
    expect(filtersVar.state._recommendedFilters![0]).toEqual({
      key: 'job',
      value: 'prometheus',
      operator: '=',
    });

    expect(groupByVar.state._recommendedGrouping).toBeDefined();
    expect(groupByVar.state._recommendedGrouping).toHaveLength(3);
    expect(groupByVar.state._recommendedGrouping![0]).toEqual({
      text: 'key1',
      value: 'key1',
    });
  });

  it('should call recommendations with correct information', async () => {
    const { scene, getRecommendedDrilldownsSpy } = await setup({});
    expect(getRecommendedDrilldownsSpy).toHaveBeenCalled();
    expect(getRecommendedDrilldownsSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        dashboardUid: 'my-dashboard-uid',
        timeRange: scene.state.$timeRange!.state.value,
        filters: [
          { key: 'originKey', operator: '=', value: 'originVal' },
          { key: 'key1', operator: '=', value: 'val1' },
          { key: 'key2', operator: '=', value: 'val2' },
        ],
        groupByKeys: ['value1', 'value2'],
      })
    );
  });
});

interface Props {
  enableRecommendations?: boolean;
  hasDashboardUid?: boolean;
  noVars?: boolean;
}

async function setup(props: Props) {
  const behavior = new RecommendedDrilldownsBehavior({ enableRecommendations: props.enableRecommendations ?? true });

  const getRecommendedDrilldownsSpy = jest.fn();
  setDataSourceSrv({
    get() {
      return {
        getRecommendedDrilldowns(props: DataSourceGetRecommendedDrilldownsOptions) {
          getRecommendedDrilldownsSpy(props);
          return {
            filters: [
              {
                key: 'job',
                value: 'prometheus',
                operator: '=',
              },
              {
                key: 'env',
                value: 'prod',
                operator: '=',
              },
              {
                key: 'cluster',
                value: 'eu-east1',
                operator: '=',
              },
              {
                key: 'pod',
                value: '111231231',
                operator: '=',
              },
            ],
            groupByKeys: ['key1', 'key2', 'key3'],
          };
        },
        getRef() {
          return { uid: 'my-ds-uid' };
        },
      };
    },
    getInstanceSettings() {
      return { uid: 'my-ds-uid' };
    },
  } as unknown as DataSourceSrv);

  const filtersVar = new AdHocFiltersVariable({
    datasource: { uid: 'my-ds-uid' },
    name: 'filters',
    applyMode: undefined,
    originFilters: [{ key: 'originKey', operator: '=', value: 'originVal' }],
    filters: [
      { key: 'key1', operator: '=', value: 'val1' },
      { key: 'key2', operator: '=', value: 'val2' },
    ],
  });

  const groupByVar = new GroupByVariable({
    datasource: { uid: 'my-ds-uid' },
    name: 'groupBy',
    value: ['value1', 'value2'],
  });

  const timeRange = new SceneTimeRange();
  const variables: SceneVariable[] = [filtersVar, groupByVar];

  const scene = new DashboardScene({
    $timeRange: timeRange,
    $behaviors: [behavior],
    $variables: props.noVars ? undefined : new SceneVariableSet({ variables }),
    uid: (props.hasDashboardUid ?? true) ? 'my-dashboard-uid' : undefined,
  });

  scene.activate();
  await new Promise((r) => setTimeout(r, 1));

  return {
    scene,
    filtersVar,
    groupByVar,
    getRecommendedDrilldownsSpy,
  };
}

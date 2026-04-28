import type { DrilldownsApplicability } from '@grafana/data';
import { type DataSourceSrv, getDataSourceSrv } from '@grafana/runtime';
import {
  AdHocFiltersVariable,
  GROUP_BY_OPERATOR,
  SceneQueryRunner,
  SceneDataTransformer,
  SceneVariableSet,
  VizPanel,
  type VizPanelState,
} from '@grafana/scenes';
import { type DataSourceRef } from '@grafana/schema';

import { DashboardScene } from '../scene/DashboardScene';
import { VizPanelSubHeader } from '../scene/VizPanelSubHeader';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';

import { getDrilldownApplicability, verifyDrilldownApplicability } from './drilldownUtils';

jest.mock('@grafana/runtime', () => {
  const actual = jest.requireActual('@grafana/runtime');
  return {
    ...actual,
    getDataSourceSrv: jest.fn(),
  };
});

const getDataSourceSrvMock = getDataSourceSrv as jest.MockedFunction<typeof getDataSourceSrv>;

const createMockDataSourceSrv = (overrides: Partial<DataSourceSrv> = {}): DataSourceSrv => ({
  get: jest.fn(),
  getList: jest.fn(),
  getInstanceSettings: jest.fn(),
  reload: jest.fn(),
  registerRuntimeDataSource: jest.fn(),
  ...overrides,
});

describe('verifyDrilldownApplicability', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns true when applicability is enabled and datasources match', () => {
    const subHeader = new VizPanelSubHeader({});

    const result = verifyDrilldownApplicability(
      subHeader,
      { uid: 'ds-1' } as DataSourceRef,
      { uid: 'ds-1' } as DataSourceRef,
      true
    );

    expect(result).toBe(true);
  });

  it('returns false when datasources differ or applicability disabled', () => {
    const subHeader = new VizPanelSubHeader({});

    const mismatch = verifyDrilldownApplicability(
      subHeader,
      { uid: 'ds-1' } as DataSourceRef,
      { uid: 'ds-2' } as DataSourceRef,
      true
    );

    expect(mismatch).toBe(false);

    const disabled = verifyDrilldownApplicability(
      subHeader,
      { uid: 'ds-1' } as DataSourceRef,
      { uid: 'ds-1' } as DataSourceRef,
      false
    );

    expect(disabled).toBe(false);
  });
});

describe('getDrilldownApplicability', () => {
  beforeEach(() => {
    const applicabilityFn = jest.fn().mockResolvedValue([]);
    getDataSourceSrvMock.mockReturnValue(
      createMockDataSourceSrv({
        get: jest.fn().mockResolvedValue({ getDrilldownsApplicability: applicabilityFn }),
        getInstanceSettings: jest.fn(),
      })
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns undefined when no drilldown variables are provided', async () => {
    const queryRunner = new SceneQueryRunner({
      datasource: { uid: 'ds-1' },
      queries: [{ refId: 'A' }],
    });

    const result = await getDrilldownApplicability(queryRunner);

    expect(result).toBeUndefined();
    expect(getDataSourceSrvMock).not.toHaveBeenCalled();
  });

  it('returns undefined when datasource lacks getDrilldownsApplicability', async () => {
    getDataSourceSrvMock.mockReturnValue(
      createMockDataSourceSrv({
        get: jest.fn().mockResolvedValue({}),
        getInstanceSettings: jest.fn(),
      })
    );

    const { queryRunner, adhocFiltersVariable } = buildScene();

    const result = await getDrilldownApplicability(queryRunner, adhocFiltersVariable);

    expect(result).toBeUndefined();
  });

  it('returns undefined when drilldown variables use a different datasource', async () => {
    const applicabilityFn = jest.fn().mockResolvedValue([]);
    getDataSourceSrvMock.mockReturnValue(
      createMockDataSourceSrv({
        get: jest.fn().mockResolvedValue({ getDrilldownsApplicability: applicabilityFn }),
        getInstanceSettings: jest.fn(),
      })
    );

    const { queryRunner, adhocFiltersVariable } = buildScene({
      datasourceUid: 'ds-query',
      filtersDatasourceUid: 'ds-other',
    });

    const result = await getDrilldownApplicability(queryRunner, adhocFiltersVariable);

    expect(result).toBeUndefined();
    expect(applicabilityFn).not.toHaveBeenCalled();
  });

  it('returns applicability data with both filters and groupBy keys from AdHocFiltersVariable', async () => {
    const applicability: DrilldownsApplicability[] = [{ key: 'region', applicable: true }];
    const getApplicability = jest.fn().mockResolvedValue(applicability);
    getDataSourceSrvMock.mockReturnValue(
      createMockDataSourceSrv({
        get: jest.fn().mockResolvedValue({ getDrilldownsApplicability: getApplicability }),
        getInstanceSettings: jest.fn(),
      })
    );

    const { queryRunner, adhocFiltersVariable } = buildScene({
      datasourceUid: 'ds-apply',
      filtersDatasourceUid: 'ds-apply',
      groupByKeys: ['region', 'instance'],
    });

    const result = await getDrilldownApplicability(queryRunner, adhocFiltersVariable);

    expect(getApplicability).toHaveBeenCalledTimes(1);
    const payload = getApplicability.mock.calls[0][0];
    expect(payload.groupByKeys).toEqual(['region', 'instance']);
    expect(payload.filters).toEqual([]);
    expect(payload.queries).toBe(queryRunner.state.queries);
    expect(payload.timeRange).toBeDefined();
    expect(result).toBe(applicability);
  });
});

interface BuildSceneOptions {
  datasourceUid?: string;
  filtersDatasourceUid?: string;
  groupByKeys?: string[];
}

function buildScene({
  datasourceUid = 'ds-1',
  filtersDatasourceUid = datasourceUid,
  groupByKeys = ['groupBy'],
}: BuildSceneOptions = {}) {
  const subHeader = new VizPanelSubHeader({});

  const queryRunner = new SceneQueryRunner({
    datasource: { uid: datasourceUid },
    queries: [{ refId: 'A', datasource: { uid: datasourceUid } }],
  });

  const groupByFilters = groupByKeys.map((key) => ({
    key,
    operator: GROUP_BY_OPERATOR,
    value: '',
    condition: '',
  }));

  const adhocFiltersVariable = new AdHocFiltersVariable({
    name: 'adhoc',
    label: 'adhoc',
    filters: groupByFilters,
    datasource: { uid: filtersDatasourceUid },
    applicabilityEnabled: true,
    enableGroupBy: true,
  });

  const dataProvider = new SceneDataTransformer({
    $data: queryRunner,
    transformations: [],
  });

  const panelState: VizPanelState = {
    key: 'panel-1',
    title: 'Panel A',
    pluginId: 'timeseries',
    subHeader,
    $data: dataProvider,
    options: {},
    fieldConfig: { defaults: {}, overrides: [] },
  };

  const panel = new VizPanel(panelState);

  new DashboardScene({
    $variables: new SceneVariableSet({
      variables: [adhocFiltersVariable],
    }),
    body: DefaultGridLayoutManager.fromVizPanels([panel]),
  });

  return { queryRunner, adhocFiltersVariable };
}

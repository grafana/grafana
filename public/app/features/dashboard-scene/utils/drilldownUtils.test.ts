import type { DrilldownsApplicability } from '@grafana/data';
import { DataSourceSrv, getDataSourceSrv } from '@grafana/runtime';
import {
  AdHocFiltersVariable,
  GroupByVariable,
  SceneQueryRunner,
  SceneDataTransformer,
  SceneVariableSet,
  VizPanel,
  VizPanelState,
} from '@grafana/scenes';
import { DataSourceRef } from '@grafana/schema';

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

// Helper to create partial DataSourceSrv mock
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

    const { queryRunner, groupByVariable } = buildScene();

    const result = await getDrilldownApplicability(queryRunner, undefined, groupByVariable);

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

    const { queryRunner, adhocFiltersVariable, groupByVariable } = buildScene({
      datasourceUid: 'ds-query',
      filtersDatasourceUid: 'ds-other',
      groupByDatasourceUid: 'ds-other',
    });

    const result = await getDrilldownApplicability(queryRunner, adhocFiltersVariable, groupByVariable);

    expect(result).toBeUndefined();
    expect(applicabilityFn).not.toHaveBeenCalled();
  });

  it('returns applicability data when datasource and variables align', async () => {
    const applicability: DrilldownsApplicability[] = [{ key: 'region', applicable: true }];
    const getApplicability = jest.fn().mockResolvedValue(applicability);
    getDataSourceSrvMock.mockReturnValue(
      createMockDataSourceSrv({
        get: jest.fn().mockResolvedValue({ getDrilldownsApplicability: getApplicability }),
        getInstanceSettings: jest.fn(),
      })
    );

    const { queryRunner, adhocFiltersVariable, groupByVariable } = buildScene({
      datasourceUid: 'ds-apply',
      filtersDatasourceUid: 'ds-apply',
      groupByDatasourceUid: 'ds-apply',
      groupValues: ['region', 'instance'],
    });

    const result = await getDrilldownApplicability(queryRunner, adhocFiltersVariable, groupByVariable);

    expect(getApplicability).toHaveBeenCalledTimes(1);
    const payload = getApplicability.mock.calls[0][0];
    expect(payload.groupByKeys).toEqual(['region', 'instance']);
    expect(payload.filters).toEqual([]);
    // Falls back to queryRunner.state.queries when request.targets is undefined
    expect(payload.queries).toBe(queryRunner.state.queries);
    expect(payload.timeRange).toBeDefined();
    expect(result).toBe(applicability);
  });
});

interface BuildSceneOptions {
  datasourceUid?: string;
  groupByDatasourceUid?: string;
  filtersDatasourceUid?: string;
  groupValues?: Array<string | number>;
}

function buildScene({
  datasourceUid = 'ds-1',
  groupByDatasourceUid = datasourceUid,
  filtersDatasourceUid = datasourceUid,
  groupValues = ['groupBy'],
}: BuildSceneOptions = {}) {
  const subHeader = new VizPanelSubHeader({});

  const queryRunner = new SceneQueryRunner({
    datasource: { uid: datasourceUid },
    queries: [{ refId: 'A', datasource: { uid: datasourceUid } }],
  });

  const adhocFiltersVariable = new AdHocFiltersVariable({
    name: 'adhoc',
    label: 'adhoc',
    filters: [],
    datasource: { uid: filtersDatasourceUid },
    applicabilityEnabled: true,
  });

  const groupByVariable = new GroupByVariable({
    name: 'group',
    label: 'group',
    value: groupValues,
    text: groupValues.map((val) => String(val)),
    options: [],
    applicabilityEnabled: true,
    datasource: { uid: groupByDatasourceUid },
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
      variables: [groupByVariable, adhocFiltersVariable],
    }),
    body: DefaultGridLayoutManager.fromVizPanels([panel]),
  });

  return { queryRunner, adhocFiltersVariable, groupByVariable };
}

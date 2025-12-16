import { of } from 'rxjs';

import { DataQueryRequest, DataSourceApi, LoadingState } from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import {
  AdHocFiltersVariable,
  GroupByVariable,
  SceneDataTransformer,
  SceneQueryRunner,
  SceneVariableSet,
  VizPanel,
  VizPanelState,
} from '@grafana/scenes';

import { activateFullSceneTree } from '../utils/test-utils';

import { DashboardScene } from './DashboardScene';
import { VizPanelSubHeader } from './VizPanelSubHeader';
import { DefaultGridLayoutManager } from './layout-default/DefaultGridLayoutManager';

const runRequestMock = jest.fn().mockImplementation((ds: DataSourceApi, request: DataQueryRequest) => {
  return of({
    state: LoadingState.Loading,
    series: [],
    timeRange: request.range,
  });
});

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getRunRequest: () => (ds: DataSourceApi, request: DataQueryRequest) => {
    return runRequestMock(ds, request);
  },
  getDataSourceSrv: () => ({
    get: jest.fn().mockResolvedValue({
      getRef: () => ({ uid: 'ds-1', type: 'test' }),
    }),
    getInstanceSettings: jest.fn().mockResolvedValue({ uid: 'ds-1', type: 'test' }),
  }),
  getPluginImportUtils: () => ({
    getPanelPluginFromCache: jest.fn(() => undefined),
  }),
}));

setPluginImportUtils({
  importPanelPlugin: () => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: () => undefined,
});

describe('VizPanelSubHeader', () => {
  it('renders when the drilldown variables apply to the panel', async () => {
    const { subHeader } = await buildScene();

    expect(subHeader.state.supportsApplicability).toBe(true);
  });

  it('renders only one drilldown var is set', async () => {
    const { subHeader } = await buildScene({ noGroupBy: true });

    expect(subHeader.state.supportsApplicability).toBe(true);
  });

  it('does not render when applicability is disabled', async () => {
    const { subHeader } = await buildScene({ applicabilityEnabled: false });

    expect(subHeader.state.supportsApplicability).toBe(false);
  });

  it('does not render when the datasource uid does not match', async () => {
    const { subHeader } = await buildScene({
      variableDatasourceUid: 'other-ds',
    });

    expect(subHeader.state.supportsApplicability).toBe(false);
  });

  it('no longer renders if variable ds changes to a different type', async () => {
    const { subHeader, adhocFiltersVariable } = await buildScene({
      noGroupBy: true,
    });

    expect(subHeader.state.supportsApplicability).toBe(true);

    adhocFiltersVariable.setState({ datasource: { uid: 'ds-2' } });

    expect(subHeader.state.supportsApplicability).toBe(false);
  });

  it('no longers renders if variable applicability becomes disabled', async () => {
    const { subHeader, adhocFiltersVariable } = await buildScene({
      noGroupBy: true,
    });

    expect(subHeader.state.supportsApplicability).toBe(true);

    adhocFiltersVariable.setState({ applicabilityEnabled: false });

    expect(subHeader.state.supportsApplicability).toBe(false);
  });

  it('continues to render if one adhoc is disabled, but groupby remains active', async () => {
    const { subHeader, adhocFiltersVariable } = await buildScene();

    expect(subHeader.state.supportsApplicability).toBe(true);

    adhocFiltersVariable.setState({ applicabilityEnabled: false });

    expect(subHeader.state.supportsApplicability).toBe(true);
  });

  it('stops rendering if queryRunner changes datasource to different one than vars', async () => {
    const { subHeader, queryRunner } = await buildScene();

    expect(subHeader.state.supportsApplicability).toBe(true);

    queryRunner.setState({ datasource: { uid: 'ds-2' } });

    expect(subHeader.state.supportsApplicability).toBe(false);
  });
});

interface BuildSceneOptions {
  applicabilityEnabled?: boolean;
  variableDatasourceUid?: string;
  noGroupBy?: boolean;
}

async function buildScene(options?: BuildSceneOptions) {
  const subHeader = new VizPanelSubHeader({});

  const queryRunner = new SceneQueryRunner({
    datasource: { uid: 'ds-1' },
    queries: [{ refId: 'A', datasource: { uid: 'ds-1' } }],
  });

  const adhocFiltersVariable = new AdHocFiltersVariable({
    name: 'adhoc',
    label: 'adhoc',
    filters: [{ key: 'filter-1', operator: '=', value: 'value-1' }],
    datasource: { uid: options?.variableDatasourceUid ?? 'ds-1' },
    applicabilityEnabled: options?.applicabilityEnabled ?? true,
  });

  const groupByVariable = new GroupByVariable({
    name: 'group',
    label: 'group',
    value: ['groupBy'],
    text: ['groupBy'],
    options: [],
    applicabilityEnabled: options?.applicabilityEnabled ?? true,
    datasource: { uid: options?.variableDatasourceUid ?? 'ds-1' },
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

  const scene = new DashboardScene({
    $variables: new SceneVariableSet({
      variables: options?.noGroupBy ? [adhocFiltersVariable] : [groupByVariable, adhocFiltersVariable],
    }),
    body: DefaultGridLayoutManager.fromVizPanels([panel]),
  });

  activateFullSceneTree(scene);

  await new Promise((r) => setTimeout(r, 1));

  return { subHeader, groupByVariable, adhocFiltersVariable, queryRunner };
}

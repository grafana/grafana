import { of } from 'rxjs';

import { DataQueryRequest, DataSourceApi, LoadingState } from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import {
  GroupByVariable,
  SceneDataTransformer,
  SceneQueryRunner,
  SceneVariableSet,
  VizPanel,
  VizPanelState,
} from '@grafana/scenes';

import { activateFullSceneTree } from '../utils/test-utils';

import { DashboardScene } from './DashboardScene';
import { VizPanelHeaderActions } from './VizPanelHeaderActions';
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

describe('VizPanelHeaderActions', () => {
  it('renders PanelGroupByAction when the group by variable applies to the panel', async () => {
    const { headerActions } = await buildScene();

    expect(headerActions.state.supportsApplicability).toBe(true);
  });

  it('does not set when applicability is disabled', async () => {
    const { headerActions } = await buildScene({ applicabilityEnabled: false });

    expect(headerActions.state.supportsApplicability).toBe(false);
  });

  it('does not set when the datasource uid does not match', async () => {
    const { headerActions } = await buildScene({
      variableDatasourceUid: 'other-ds',
    });

    expect(headerActions.state.supportsApplicability).toBe(false);
  });

  it('does not set if variable ds changes to a different type', async () => {
    const { headerActions, groupByVariable } = await buildScene();

    expect(headerActions.state.supportsApplicability).toBe(true);

    groupByVariable.setState({ datasource: { uid: 'ds-2' } });

    expect(headerActions.state.supportsApplicability).toBe(false);
  });

  it('does not set if variable applicability becomes disabled', async () => {
    const { headerActions, groupByVariable } = await buildScene();

    expect(headerActions.state.supportsApplicability).toBe(true);

    groupByVariable.setState({ applicabilityEnabled: false });

    expect(headerActions.state.supportsApplicability).toBe(false);
  });

  it('sdoes not set if queryRunner changes datasource to different one than vars', async () => {
    const { headerActions, queryRunner } = await buildScene();

    expect(headerActions.state.supportsApplicability).toBe(true);

    queryRunner.setState({ datasource: { uid: 'ds-2' } });

    expect(headerActions.state.supportsApplicability).toBe(false);
  });
});

interface BuildSceneOptions {
  applicabilityEnabled?: boolean;
  variableDatasourceUid?: string;
}

async function buildScene(options?: BuildSceneOptions) {
  const headerActions = new VizPanelHeaderActions({});

  const queryRunner = new SceneQueryRunner({
    datasource: { uid: 'ds-1' },
    queries: [{ refId: 'A', datasource: { uid: 'ds-1' } }],
  });

  const groupByVariable = new GroupByVariable({
    name: 'group',
    label: 'group',
    value: [],
    text: [],
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
    headerActions,
    $data: dataProvider,
    options: {},
    fieldConfig: { defaults: {}, overrides: [] },
  };

  const panel = new VizPanel(panelState);

  const scene = new DashboardScene({
    $variables: new SceneVariableSet({
      variables: [groupByVariable],
    }),
    body: DefaultGridLayoutManager.fromVizPanels([panel]),
  });

  activateFullSceneTree(scene);

  await new Promise((r) => setTimeout(r, 1));

  return { headerActions, panel, groupByVariable, queryRunner };
}

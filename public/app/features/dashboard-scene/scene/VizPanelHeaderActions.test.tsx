import { of } from 'rxjs';

import { getPanelPlugin } from '@grafana/data/test';
import { type DataQueryRequest, type DataSourceApi, LoadingState } from '@grafana/data/types';
import { setPluginImportUtils } from '@grafana/runtime';
import {
  AdHocFiltersVariable,
  GroupByVariable,
  SceneDataTransformer,
  SceneQueryRunner,
  SceneVariableSet,
  VizPanel,
  type VizPanelState,
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
  describe('isGroupByActionSupported', () => {
    it('is true when group by variable DS matches query DS', async () => {
      const { headerActions } = await buildScene();

      expect(headerActions.state.isGroupByActionSupported).toBe(true);
    });

    it('is false when group by variable DS does not match query DS', async () => {
      const { headerActions } = await buildScene({ variableDatasourceUid: 'other-ds' });

      expect(headerActions.state.isGroupByActionSupported).toBe(false);
    });

    it('becomes false when group by variable DS changes to a different one', async () => {
      const { headerActions, groupByVariable } = await buildScene();

      expect(headerActions.state.isGroupByActionSupported).toBe(true);

      groupByVariable.setState({ datasource: { uid: 'ds-2' } });

      expect(headerActions.state.isGroupByActionSupported).toBe(false);
    });

    it('becomes false when queryRunner changes queries DS to a different one', async () => {
      const { headerActions, queryRunner } = await buildScene();

      expect(headerActions.state.isGroupByActionSupported).toBe(true);

      queryRunner.setState({
        datasource: { uid: 'ds-2' },
        queries: [{ refId: 'A', datasource: { uid: 'ds-2' } }],
      });

      expect(headerActions.state.isGroupByActionSupported).toBe(false);
    });

    it('becomes true when a group by variable is added to the dashboard', async () => {
      const { headerActions, variableSet, groupByVariable } = await buildScene({ withoutGroupBy: true });

      expect(headerActions.state.isGroupByActionSupported).toBe(false);

      variableSet.setState({ variables: [groupByVariable] });

      expect(headerActions.state.isGroupByActionSupported).toBe(true);
    });

    it('becomes false when the group by variable is removed', async () => {
      const { headerActions, variableSet } = await buildScene();

      expect(headerActions.state.isGroupByActionSupported).toBe(true);

      variableSet.setState({ variables: [] });

      expect(headerActions.state.isGroupByActionSupported).toBe(false);
    });
  });

  describe('isGroupByActionSupported with unified AdHocFiltersVariable', () => {
    it('is true when adhoc variable with enableGroupBy has matching DS', async () => {
      const { headerActions } = await buildScene({ useUnifiedGroupBy: true });

      expect(headerActions.state.isGroupByActionSupported).toBe(true);
    });

    it('is false when adhoc variable DS does not match query DS', async () => {
      const { headerActions } = await buildScene({ useUnifiedGroupBy: true, variableDatasourceUid: 'other-ds' });

      expect(headerActions.state.isGroupByActionSupported).toBe(false);
    });

    it('becomes false when adhoc variable DS changes', async () => {
      const { headerActions, adhocVariable } = await buildScene({ useUnifiedGroupBy: true });

      expect(headerActions.state.isGroupByActionSupported).toBe(true);

      adhocVariable!.setState({ datasource: { uid: 'ds-2' } });

      expect(headerActions.state.isGroupByActionSupported).toBe(false);
    });

    it('becomes false when enableGroupBy is toggled off', async () => {
      const { headerActions, adhocVariable } = await buildScene({ useUnifiedGroupBy: true });

      expect(headerActions.state.isGroupByActionSupported).toBe(true);

      adhocVariable!.setState({ enableGroupBy: false });

      expect(headerActions.state.isGroupByActionSupported).toBe(false);
    });
  });
});

interface BuildSceneOptions {
  variableDatasourceUid?: string;
  withoutGroupBy?: boolean;
  useUnifiedGroupBy?: boolean;
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
    datasource: { uid: options?.variableDatasourceUid ?? 'ds-1' },
  });

  const adhocVariable = options?.useUnifiedGroupBy
    ? new AdHocFiltersVariable({
        name: 'adhoc',
        datasource: { uid: options?.variableDatasourceUid ?? 'ds-1' },
        filters: [],
        enableGroupBy: true,
      })
    : undefined;

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

  let variables: Array<GroupByVariable | AdHocFiltersVariable>;
  if (options?.withoutGroupBy) {
    variables = [];
  } else if (options?.useUnifiedGroupBy && adhocVariable) {
    variables = [adhocVariable];
  } else {
    variables = [groupByVariable];
  }

  const variableSet = new SceneVariableSet({ variables });

  const scene = new DashboardScene({
    $variables: variableSet,
    body: DefaultGridLayoutManager.fromVizPanels([panel]),
  });

  activateFullSceneTree(scene);

  await new Promise((r) => setTimeout(r, 1));

  return { headerActions, panel, groupByVariable, adhocVariable, queryRunner, variableSet };
}

import { of } from 'rxjs';

import { type DataQueryRequest, type DataSourceApi, LoadingState } from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
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
import { PanelPluginDataTransformer } from './PanelPluginDataTransformer';
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

  describe('getQueryRunner', () => {
    it('finds the query runner directly under the user transformer', async () => {
      const { headerActions, queryRunner } = await buildScene();

      const found = headerActions.getQueryRunner();

      expect(found).toBeInstanceOf(SceneQueryRunner);
      // Compared as a boolean: scene objects hold circular references, so a failing `toBe`
      // diff cannot be serialized by the jest reporter.
      expect(found === queryRunner).toBe(true);
    });

    it('finds the query runner through a nested panel-plugin transformer', async () => {
      const { headerActions, queryRunner } = await buildScene({ withPluginTransformer: true });

      // Unwrapping a single level of `$data` lands on the plugin transformer and would silently
      // return null here, disabling every header action on the panel.
      const found = headerActions.getQueryRunner();

      expect(found).toBeInstanceOf(SceneQueryRunner);
      // Compared as a boolean: scene objects hold circular references, so a failing `toBe`
      // diff cannot be serialized by the jest reporter.
      expect(found === queryRunner).toBe(true);
    });

    it('finds the query runner when it is the panel data provider itself', async () => {
      const { headerActions, queryRunner } = await buildScene({ withBareQueryRunner: true });

      // Documents a deliberate widening: the previous one-level unwrap returned null for a
      // panel whose `$data` is the runner itself, disabling its header actions. No dashboard
      // path builds that chain today, but unwrapping zero transformer levels is just as valid.
      const found = headerActions.getQueryRunner();

      expect(found).toBeInstanceOf(SceneQueryRunner);
      // Compared as a boolean: scene objects hold circular references, so a failing `toBe`
      // diff cannot be serialized by the jest reporter.
      expect(found === queryRunner).toBe(true);
    });
  });
});

interface BuildSceneOptions {
  variableDatasourceUid?: string;
  withoutGroupBy?: boolean;
  useUnifiedGroupBy?: boolean;
  /** Nest a panel-plugin transformer between the query runner and the user's transformer. */
  withPluginTransformer?: boolean;
  /** Set the query runner directly as the panel's `$data`, with no transformer wrapping it. */
  withBareQueryRunner?: boolean;
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

  const dataProvider = options?.withBareQueryRunner
    ? queryRunner
    : new SceneDataTransformer({
        $data: options?.withPluginTransformer
          ? new PanelPluginDataTransformer({ $data: queryRunner, transformations: [] })
          : queryRunner,
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

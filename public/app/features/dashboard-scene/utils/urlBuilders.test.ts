import {
  type AdHocVariableFilter,
  type DataQueryRequest,
  getDefaultTimeRange,
  LoadingState,
  type PanelData,
} from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import {
  locationService,
  setTemplateSrv,
  type TemplateSrv,
} from '@grafana/runtime';
import {
  AdHocFiltersVariable,
  EmbeddedScene,
  SceneQueryRunner,
  SceneTimeRange,
  SceneVariableSet,
  VizPanel,
} from '@grafana/scenes';
import { contextSrv } from 'app/core/services/context_srv';
import { getExploreUrl } from 'app/core/utils/explore';

import { DashboardScene } from '../scene/DashboardScene';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';

import { getAdhocFiltersForPanel, getEditPanelUrl, tryGetExploreUrlForPanel } from './urlBuilders';

jest.mock('app/core/services/context_srv');
jest.mock('app/core/utils/explore');

const mockGetDataSourceInstanceSettings = jest.fn();
const mockGetDataSourceInstance = jest.fn();

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  getDataSourceInstanceSettings: (ref: unknown) => mockGetDataSourceInstanceSettings(ref),
  getDataSourceInstance: (ref: unknown) => mockGetDataSourceInstance(ref),
}));

interface TestFilter extends AdHocVariableFilter {
  nonApplicable?: boolean;
}

describe('urlBuilders', () => {
  const mockContextSrv = jest.mocked(contextSrv);
  const mockGetExploreUrl = jest.mocked(getExploreUrl);
  let mockGetAdhocFilters: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockContextSrv.hasAccessToExplore.mockReturnValue(true);
    mockGetExploreUrl.mockResolvedValue('/explore?panes=...');

    mockGetDataSourceInstance.mockImplementation((ref: unknown) => {
      return Promise.resolve({
        interpolateVariablesInQueries: jest.fn((queries) => queries),
      });
    });

    mockGetAdhocFilters = jest.fn().mockReturnValue([]);
    setTemplateSrv({
      getAdhocFilters: mockGetAdhocFilters,
    } as unknown as TemplateSrv);

    mockGetDataSourceInstanceSettings.mockImplementation((ref: unknown) => {
      if (!ref) {
        return Promise.resolve({ uid: 'default-prom', name: 'Default Prom', isDefault: true });
      }
      const uid = typeof ref === 'string' ? ref : (ref as { uid?: string }).uid;
      if (uid === 'prom-1') {
        return Promise.resolve({ uid: 'prom-1', name: 'Prometheus 1' });
      }
      if (uid === 'loki-1') {
        return Promise.resolve({ uid: 'loki-1', name: 'Loki 1' });
      }
      if (uid === 'default-prom') {
        return Promise.resolve({ uid: 'default-prom', name: 'Default Prom', isDefault: true });
      }
      return Promise.resolve(undefined);
    });
  });

  describe('getEditPanelUrl', () => {
    it('should generate URL with editPanel param and clear viewPanel', () => {
      locationService.push('/d/dash-1?viewPanel=12');
      const url = getEditPanelUrl(12);
      expect(url).toContain('editPanel=12');
      expect(url).not.toContain('viewPanel=12');
    });
  });

  describe('tryGetExploreUrlForPanel', () => {
    it('should return undefined if user lacks explore access', async () => {
      mockContextSrv.hasAccessToExplore.mockReturnValue(false);
      const panel = new VizPanel({
        pluginId: 'timeseries',
        $data: new SceneQueryRunner({ queries: [{ refId: 'A' }] }),
      });
      panel.getPlugin = () => getPanelPlugin({ skipDataQuery: false });

      const url = await tryGetExploreUrlForPanel(panel);
      expect(url).toBeUndefined();
    });

    it('should return undefined if plugin skips data query', async () => {
      const panel = new VizPanel({
        pluginId: 'text',
        $data: new SceneQueryRunner({ queries: [{ refId: 'A' }] }),
      });
      panel.getPlugin = () => getPanelPlugin({ skipDataQuery: true });

      const url = await tryGetExploreUrlForPanel(panel);
      expect(url).toBeUndefined();
    });

    it('should return undefined if panel has no query runner', async () => {
      const panel = new VizPanel({
        pluginId: 'timeseries',
      });
      panel.getPlugin = () => getPanelPlugin({ skipDataQuery: false });

      const url = await tryGetExploreUrlForPanel(panel);
      expect(url).toBeUndefined();
    });

    it('should build explore url passing panel queries, dsRef, timeRange, and scopedVars', async () => {
      const queryRunner = new SceneQueryRunner({
        datasource: { uid: 'prom-1' },
        queries: [{ refId: 'A' }],
      });
      const panel = new VizPanel({
        pluginId: 'timeseries',
        $data: queryRunner,
      });
      panel.getPlugin = () => getPanelPlugin({ skipDataQuery: false });

      const scene = new DashboardScene({
        title: 'Dash',
        uid: 'dash-1',
        $timeRange: new SceneTimeRange({ from: 'now-1h', to: 'now' }),
        body: DefaultGridLayoutManager.fromVizPanels([panel]),
      });

      const url = await tryGetExploreUrlForPanel(panel);
      expect(url).toBe('/explore?panes=...');
      expect(mockGetExploreUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          queries: [{ refId: 'A' }],
          dsRef: { uid: 'prom-1' },
          scopedVars: { __sceneObject: { value: panel } },
        })
      );
    });

    it('should pass active adhoc filters to getExploreUrl when navigating to explore from panel', async () => {
      const queryRunner = new SceneQueryRunner({
        datasource: { uid: 'prom-1' },
        queries: [{ refId: 'A' }],
      });
      const panel = new VizPanel({
        pluginId: 'timeseries',
        $data: queryRunner,
      });
      panel.getPlugin = () => getPanelPlugin({ skipDataQuery: false });

      const adhocVar = new AdHocFiltersVariable({
        name: 'AdHoc',
        datasource: { uid: 'prom-1' },
        filters: [{ key: 'cluster', operator: '=', value: 'us-east' }],
      });

      const scene = new DashboardScene({
        title: 'Dash',
        uid: 'dash-1',
        $timeRange: new SceneTimeRange({ from: 'now-1h', to: 'now' }),
        $variables: new SceneVariableSet({
          variables: [adhocVar],
        }),
        body: DefaultGridLayoutManager.fromVizPanels([panel]),
      });

      await tryGetExploreUrlForPanel(panel);
      expect(mockGetExploreUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          adhocFilters: [{ key: 'cluster', operator: '=', value: 'us-east' }],
        })
      );
    });

    it('should isolate adhoc filters per datasource for mixed-datasource panels when calling getExploreUrl', async () => {
      const promQuery = { refId: 'A', datasource: { uid: 'prom-1' } };
      const lokiQuery = { refId: 'B', datasource: { uid: 'loki-1' } };
      const queryRunner = new SceneQueryRunner({
        datasource: { uid: '-- Mixed --' },
        queries: [promQuery, lokiQuery],
      });
      const panel = new VizPanel({
        pluginId: 'timeseries',
        $data: queryRunner,
      });
      panel.getPlugin = () => getPanelPlugin({ skipDataQuery: false });

      const promAdhoc = new AdHocFiltersVariable({
        name: 'PromFilters',
        datasource: { uid: 'prom-1' },
        filters: [{ key: 'job', operator: '=', value: 'grafana' }],
      });
      const lokiAdhoc = new AdHocFiltersVariable({
        name: 'LokiFilters',
        datasource: { uid: 'loki-1' },
        filters: [{ key: 'level', operator: '=', value: 'error' }],
      });

      new DashboardScene({
        title: 'Mixed Dash',
        uid: 'dash-mixed',
        $timeRange: new SceneTimeRange({ from: 'now-1h', to: 'now' }),
        $variables: new SceneVariableSet({
          variables: [promAdhoc, lokiAdhoc],
        }),
        body: DefaultGridLayoutManager.fromVizPanels([panel]),
      });

      const mockPromInterpolate = jest.fn((queries, scopedVars, filters) => [
        { ...queries[0], interpolatedFilters: filters },
      ]);
      const mockLokiInterpolate = jest.fn((queries, scopedVars, filters) => [
        { ...queries[0], interpolatedFilters: filters },
      ]);

      mockGetDataSourceInstance.mockImplementation(async (ref: unknown) => {
        const uid = typeof ref === 'string' ? ref : (ref as { uid?: string })?.uid;
        if (uid === 'prom-1') {
          return { interpolateVariablesInQueries: mockPromInterpolate };
        }
        if (uid === 'loki-1') {
          return { interpolateVariablesInQueries: mockLokiInterpolate };
        }
        return undefined;
      });

      await tryGetExploreUrlForPanel(panel);

      expect(mockPromInterpolate).toHaveBeenCalledWith(
        [promQuery],
        expect.anything(),
        [{ key: 'job', operator: '=', value: 'grafana' }]
      );
      expect(mockLokiInterpolate).toHaveBeenCalledWith(
        [lokiQuery],
        expect.anything(),
        [{ key: 'level', operator: '=', value: 'error' }]
      );
      expect(mockGetExploreUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          queries: [
            expect.objectContaining({ refId: 'A', interpolatedFilters: [{ key: 'job', operator: '=', value: 'grafana' }] }),
            expect.objectContaining({ refId: 'B', interpolatedFilters: [{ key: 'level', operator: '=', value: 'error' }] }),
          ],
          adhocFilters: undefined,
        })
      );
    });
  });

  describe('getAdhocFiltersForPanel', () => {
    it('should use queryRunner.state.data.request.filters if present and populated', async () => {
      const requestFilters = [{ key: 'cluster', operator: '=', value: 'us-east' }];
      const queryRunner = new SceneQueryRunner({
        datasource: { uid: 'prom-1' },
        queries: [{ refId: 'A' }],
      });
      const dataRequest: unknown = {
        app: 'dashboard',
        requestId: 'Q100',
        timezone: 'browser',
        panelId: 1,
        dashboardUID: 'dash-1',
        range: getDefaultTimeRange(),
        interval: '1s',
        intervalMs: 1000,
        targets: [],
        scopedVars: {},
        filters: requestFilters,
      };
      const panelData: PanelData = {
        state: LoadingState.Done,
        series: [],
        timeRange: getDefaultTimeRange(),
        request: dataRequest as DataQueryRequest,
      };
      queryRunner.setState({
        data: panelData,
      });

      const panel = new VizPanel({
        pluginId: 'timeseries',
        $data: queryRunner,
      });

      const filters = await getAdhocFiltersForPanel(panel, queryRunner, { uid: 'prom-1' });
      expect(filters).toEqual(requestFilters);
    });

    it('should use _drilldownDependenciesManager.getFilters() if request.filters is missing', async () => {
      const drilldownFilters = [{ key: 'env', operator: '=', value: 'production' }];
      const queryRunner = new SceneQueryRunner({
        datasource: { uid: 'prom-1' },
        queries: [{ refId: 'A' }],
      });
      Object.assign(queryRunner, {
        _drilldownDependenciesManager: {
          getFilters: jest.fn().mockReturnValue(drilldownFilters),
        },
      });

      const panel = new VizPanel({
        pluginId: 'timeseries',
        $data: queryRunner,
      });

      const filters = await getAdhocFiltersForPanel(panel, queryRunner, { uid: 'prom-1' });
      expect(filters).toEqual(drilldownFilters);
    });

    it('should retrieve adhoc filters from scene hierarchy when query runner has not run yet', async () => {
      const queryRunner = new SceneQueryRunner({
        datasource: { uid: 'prom-1' },
        queries: [{ refId: 'A' }],
      });
      const panel = new VizPanel({
        pluginId: 'timeseries',
        $data: queryRunner,
      });

      const adhocVar = new AdHocFiltersVariable({
        name: 'AdHoc',
        datasource: { uid: 'prom-1' },
        filters: [{ key: 'service', operator: '=', value: 'auth' }],
      });

      const scene = new DashboardScene({
        title: 'Dash',
        uid: 'dash-1',
        $variables: new SceneVariableSet({
          variables: [adhocVar],
        }),
        body: DefaultGridLayoutManager.fromVizPanels([panel]),
      });

      const filters = await getAdhocFiltersForPanel(panel, queryRunner, { uid: 'prom-1' });
      expect(filters).toEqual([{ key: 'service', operator: '=', value: 'auth' }]);
    });

    it('should merge originFilters and filters, excluding duplicates', async () => {
      const queryRunner = new SceneQueryRunner({
        datasource: { uid: 'prom-1' },
        queries: [{ refId: 'A' }],
      });
      const panel = new VizPanel({
        pluginId: 'timeseries',
        $data: queryRunner,
      });

      const adhocVar = new AdHocFiltersVariable({
        name: 'AdHoc',
        datasource: { uid: 'prom-1' },
        originFilters: [
          { key: 'cluster', operator: '=', value: 'eu-west', origin: 'dashboard' },
          { key: 'namespace', operator: '=', value: 'kube-system', origin: 'dashboard' },
        ],
        filters: [
          { key: 'namespace', operator: '=', value: 'kube-system', origin: 'dashboard' },
          { key: 'app', operator: '=', value: 'grafana' },
        ],
      });

      const scene = new DashboardScene({
        title: 'Dash',
        uid: 'dash-1',
        $variables: new SceneVariableSet({
          variables: [adhocVar],
        }),
        body: DefaultGridLayoutManager.fromVizPanels([panel]),
      });

      const filters = await getAdhocFiltersForPanel(panel, queryRunner, { uid: 'prom-1' });
      expect(filters).toEqual([
        { key: 'cluster', operator: '=', value: 'eu-west', origin: 'dashboard' },
        { key: 'namespace', operator: '=', value: 'kube-system', origin: 'dashboard' },
        { key: 'app', operator: '=', value: 'grafana' },
      ]);
    });

    it('should exclude incomplete, groupBy, nonApplicable, and match-all filters', async () => {
      const queryRunner = new SceneQueryRunner({
        datasource: { uid: 'prom-1' },
        queries: [{ refId: 'A' }],
      });
      const panel = new VizPanel({
        pluginId: 'timeseries',
        $data: queryRunner,
      });

      const disabledFilter: TestFilter = {
        key: 'disabled',
        operator: '=',
        value: 'val',
        nonApplicable: true,
      };

      const adhocVar = new AdHocFiltersVariable({
        name: 'AdHoc',
        datasource: { uid: 'prom-1' },
        filters: [
          { key: 'app', operator: '=', value: 'valid' },
          { key: '', operator: '=', value: 'no-key' },
          { key: 'no-op', operator: '', value: 'test' },
          { key: 'no-val', operator: '=', value: '' },
          { key: 'host', operator: 'groupBy', value: '' },
          disabledFilter,
          { key: 'all_regex', operator: '=~', value: '.*' },
          { key: 'all_multi', operator: '=|', values: ['__all__'], value: '' },
        ],
      });

      const scene = new DashboardScene({
        title: 'Dash',
        uid: 'dash-1',
        $variables: new SceneVariableSet({
          variables: [adhocVar],
        }),
        body: DefaultGridLayoutManager.fromVizPanels([panel]),
      });

      const filters = await getAdhocFiltersForPanel(panel, queryRunner, { uid: 'prom-1' });
      expect(filters).toEqual([{ key: 'app', operator: '=', value: 'valid' }]);
    });

    it('should ignore adhoc variable when applyMode is manual', async () => {
      const queryRunner = new SceneQueryRunner({
        datasource: { uid: 'prom-1' },
        queries: [{ refId: 'A' }],
      });
      const panel = new VizPanel({
        pluginId: 'timeseries',
        $data: queryRunner,
      });

      const adhocVar = new AdHocFiltersVariable({
        name: 'AdHoc',
        datasource: { uid: 'prom-1' },
        applyMode: 'manual',
        filters: [{ key: 'app', operator: '=', value: 'test' }],
      });

      const scene = new DashboardScene({
        title: 'Dash',
        uid: 'dash-1',
        $variables: new SceneVariableSet({
          variables: [adhocVar],
        }),
        body: DefaultGridLayoutManager.fromVizPanels([panel]),
      });

      const filters = await getAdhocFiltersForPanel(panel, queryRunner, { uid: 'prom-1' });
      expect(filters).toBeUndefined();
    });

    it('should match default datasource when panel and variable omit datasource or specify default', async () => {
      const queryRunner = new SceneQueryRunner({
        queries: [{ refId: 'A' }],
      });
      const panel = new VizPanel({
        pluginId: 'timeseries',
        $data: queryRunner,
      });

      const adhocVar = new AdHocFiltersVariable({
        name: 'AdHoc',
        datasource: null,
        filters: [{ key: 'env', operator: '=', value: 'prod' }],
      });

      const scene = new DashboardScene({
        title: 'Dash',
        uid: 'dash-1',
        $variables: new SceneVariableSet({
          variables: [adhocVar],
        }),
        body: DefaultGridLayoutManager.fromVizPanels([panel]),
      });

      const filters = await getAdhocFiltersForPanel(panel, queryRunner, undefined);
      expect(filters).toEqual([{ key: 'env', operator: '=', value: 'prod' }]);
    });

    it('should not match when datasource UIDs do not match', async () => {
      const queryRunner = new SceneQueryRunner({
        datasource: { uid: 'loki-1' },
        queries: [{ refId: 'A' }],
      });
      const panel = new VizPanel({
        pluginId: 'timeseries',
        $data: queryRunner,
      });

      const adhocVar = new AdHocFiltersVariable({
        name: 'AdHoc',
        datasource: { uid: 'prom-1' },
        filters: [{ key: 'env', operator: '=', value: 'prod' }],
      });

      const scene = new DashboardScene({
        title: 'Dash',
        uid: 'dash-1',
        $variables: new SceneVariableSet({
          variables: [adhocVar],
        }),
        body: DefaultGridLayoutManager.fromVizPanels([panel]),
      });

      const filters = await getAdhocFiltersForPanel(panel, queryRunner, { uid: 'loki-1' });
      expect(filters).toBeUndefined();
    });

    it('should fall back to getTemplateSrv().getAdhocFilters if no scene filters exist', async () => {
      const legacyFilters = [{ key: 'team', operator: '=', value: 'backend' }];
      mockGetAdhocFilters.mockImplementation((ds) => {
        if (ds === 'prom-1') {
          return legacyFilters;
        }
        return [];
      });

      const queryRunner = new SceneQueryRunner({
        datasource: { uid: 'prom-1' },
        queries: [{ refId: 'A' }],
      });
      const panel = new VizPanel({
        pluginId: 'timeseries',
        $data: queryRunner,
      });

      const filters = await getAdhocFiltersForPanel(panel, queryRunner, { uid: 'prom-1' });
      expect(filters).toEqual(legacyFilters);
    });

    it('should support mixed datasource panels and match adhoc filters across query rows', async () => {
      const queryRunner = new SceneQueryRunner({
        datasource: { uid: '-- Mixed --' },
        queries: [
          { refId: 'A', datasource: { uid: 'prom-1' } },
          { refId: 'B', datasource: { uid: 'loki-1' } },
        ],
      });
      const panel = new VizPanel({
        pluginId: 'timeseries',
        $data: queryRunner,
      });

      const promAdhoc = new AdHocFiltersVariable({
        name: 'PromAdhoc',
        datasource: { uid: 'prom-1' },
        filters: [{ key: 'app', operator: '=', value: 'api' }],
      });
      const lokiAdhoc = new AdHocFiltersVariable({
        name: 'LokiAdhoc',
        datasource: { uid: 'loki-1' },
        filters: [{ key: 'level', operator: '=', value: 'error' }],
      });

      const scene = new DashboardScene({
        title: 'Mixed Dash',
        uid: 'dash-mixed',
        $variables: new SceneVariableSet({
          variables: [promAdhoc, lokiAdhoc],
        }),
        body: DefaultGridLayoutManager.fromVizPanels([panel]),
      });

      const filters = await getAdhocFiltersForPanel(panel, queryRunner, { uid: '-- Mixed --' });
      expect(filters).toEqual([
        { key: 'app', operator: '=', value: 'api' },
        { key: 'level', operator: '=', value: 'error' },
      ]);
    });

    it('should support string datasource definitions for panels and variables', async () => {
      const queryRunner = new SceneQueryRunner({
        queries: [{ refId: 'A', datasource: 'prom-1' as unknown as { uid: string } }],
      });
      const panel = new VizPanel({
        pluginId: 'timeseries',
        $data: queryRunner,
      });

      const adhocVar = new AdHocFiltersVariable({
        name: 'AdHoc',
        datasource: 'prom-1',
        filters: [{ key: 'job', operator: '=', value: 'node' }],
      });

      const scene = new DashboardScene({
        title: 'Dash',
        uid: 'dash-1',
        $variables: new SceneVariableSet({
          variables: [adhocVar],
        }),
        body: DefaultGridLayoutManager.fromVizPanels([panel]),
      });

      const filters = await getAdhocFiltersForPanel(panel, queryRunner, 'prom-1' as unknown as { uid: string });
      expect(filters).toEqual([{ key: 'job', operator: '=', value: 'node' }]);
    });

    it('should sanitize invalid and groupBy filters present on queryRunner.state.data.request.filters', async () => {
      const queryRunner = new SceneQueryRunner({
        datasource: { uid: 'prom-1' },
        queries: [{ refId: 'A' }],
      });
      const rawRequestFilters: AdHocVariableFilter[] = [
        { key: 'valid', operator: '=', value: 'yes' },
        { key: 'grouped', operator: 'groupBy', value: '' },
        { key: '', operator: '=', value: 'no-key' },
      ];
      queryRunner.setState({
        data: {
          state: LoadingState.Done,
          series: [],
          timeRange: getDefaultTimeRange(),
          request: {
            app: 'dashboard',
            requestId: 'Q1',
            timezone: 'browser',
            panelId: 1,
            dashboardUID: 'dash-1',
            range: getDefaultTimeRange(),
            interval: '1s',
            intervalMs: 1000,
            targets: [],
            scopedVars: {},
            filters: rawRequestFilters,
          } as unknown as DataQueryRequest,
        },
      });

      const panel = new VizPanel({
        pluginId: 'timeseries',
        $data: queryRunner,
      });

      const filters = await getAdhocFiltersForPanel(panel, queryRunner, { uid: 'prom-1' });
      expect(filters).toEqual([{ key: 'valid', operator: '=', value: 'yes' }]);
    });

    it('does not leak manual applyMode filters via templateSrv fallback', async () => {
      const queryRunner = new SceneQueryRunner({
        queries: [{ refId: 'A', datasource: { uid: 'prom-1' } }],
      });

      const manualVar = new AdHocFiltersVariable({
        name: 'manual_adhoc',
        datasource: { uid: 'prom-1' },
        applyMode: 'manual',
        filters: [{ key: 'cluster', operator: '=', value: 'manual-val' }],
      });

      const panel = new VizPanel({
        pluginId: 'timeseries',
        $data: queryRunner,
      });

      new EmbeddedScene({
        $variables: new SceneVariableSet({ variables: [manualVar] }),
        body: panel,
      });

      // templateSrv mock returns filters if queried
      mockGetAdhocFilters.mockReturnValue([{ key: 'cluster', operator: '=', value: 'manual-val' }]);

      const filters = await getAdhocFiltersForPanel(panel, queryRunner, { uid: 'prom-1' });
      expect(filters).toBeUndefined();
    });

    it('shadows ancestor adhoc variable when an inner scope defines a variable with the same name', async () => {
      const queryRunner = new SceneQueryRunner({
        queries: [{ refId: 'A', datasource: { uid: 'prom-1' } }],
      });
      const panel = new VizPanel({
        pluginId: 'timeseries',
        $data: queryRunner,
      });

      const rootAdhoc = new AdHocFiltersVariable({
        name: 'AdHoc',
        datasource: { uid: 'prom-1' },
        filters: [{ key: 'env', operator: '=', value: 'prod' }],
      });
      const innerAdhoc = new AdHocFiltersVariable({
        name: 'AdHoc',
        datasource: { uid: 'prom-1' },
        filters: [{ key: 'env', operator: '=', value: 'dev' }],
      });

      const innerScene = new EmbeddedScene({
        $variables: new SceneVariableSet({ variables: [innerAdhoc] }),
        body: panel,
      });

      new DashboardScene({
        title: 'Dash',
        uid: 'dash-1',
        $variables: new SceneVariableSet({ variables: [rootAdhoc] }),
        body: DefaultGridLayoutManager.fromVizPanels([innerScene as unknown as VizPanel]),
      });

      const filters = await getAdhocFiltersForPanel(panel, queryRunner, { uid: 'prom-1' });
      expect(filters).toEqual([{ key: 'env', operator: '=', value: 'dev' }]);
    });

    it('does not match default datasource variable against non-default typed instance with concrete uid', async () => {
      const queryRunner = new SceneQueryRunner({
        queries: [{ refId: 'A', datasource: { uid: 'concrete-loki-uid', type: 'loki' } }],
      });

      const defaultVar = new AdHocFiltersVariable({
        name: 'default_adhoc',
        datasource: { uid: 'default' },
        filters: [{ key: 'service', operator: '=', value: 'auth' }],
      });

      const panel = new VizPanel({
        pluginId: 'timeseries',
        $data: queryRunner,
      });

      new EmbeddedScene({
        $variables: new SceneVariableSet({ variables: [defaultVar] }),
        body: panel,
      });

      mockGetDataSourceInstanceSettings.mockImplementation(async (ref: unknown) => {
        if (typeof ref === 'object' && ref !== null && (ref as { uid?: string }).uid === 'default') {
          return { uid: 'default-prom-uid', name: 'Prometheus', type: 'prometheus', isDefault: true } as DataSourceInstanceSettings;
        }
        if (typeof ref === 'object' && ref !== null && (ref as { uid?: string }).uid === 'concrete-loki-uid') {
          return { uid: 'concrete-loki-uid', name: 'Loki-Prod', type: 'loki', isDefault: false } as DataSourceInstanceSettings;
        }
        return undefined;
      });

      const filters = await getAdhocFiltersForPanel(panel, queryRunner, { uid: 'concrete-loki-uid', type: 'loki' });
      expect(filters).toBeUndefined();
    });

    it('does not match default datasource variable against different non-default instance of the same type', async () => {
      const queryRunner = new SceneQueryRunner({
        queries: [{ refId: 'A', datasource: { uid: 'prom-2', type: 'prometheus' } }],
      });

      const defaultPromVar = new AdHocFiltersVariable({
        name: 'default_prom_adhoc',
        datasource: { uid: 'default' },
        filters: [{ key: 'cluster', operator: '=', value: 'default-cluster' }],
      });

      const panel = new VizPanel({
        pluginId: 'timeseries',
        $data: queryRunner,
      });

      new EmbeddedScene({
        $variables: new SceneVariableSet({ variables: [defaultPromVar] }),
        body: panel,
      });

      mockGetDataSourceInstanceSettings.mockImplementation(async (ref: unknown) => {
        const uid = typeof ref === 'object' && ref !== null ? (ref as { uid?: string }).uid : ref;
        if (uid === 'default' || !uid) {
          return { uid: 'default-prom-uid', name: 'Prometheus Default', type: 'prometheus', isDefault: true } as DataSourceInstanceSettings;
        }
        if (uid === 'prom-2') {
          return { uid: 'prom-2', name: 'Prometheus Secondary', type: 'prometheus', isDefault: false } as DataSourceInstanceSettings;
        }
        return undefined;
      });

      const filters = await getAdhocFiltersForPanel(panel, queryRunner, { uid: 'prom-2', type: 'prometheus' });
      expect(filters).toBeUndefined();
    });

    it('does not leak request.filters across datasources on mixed panels when targeting a specific datasource', async () => {
      const queryRunner = new SceneQueryRunner({
        datasource: { uid: '-- Mixed --' },
        queries: [
          { refId: 'A', datasource: { uid: 'prom-1' } },
          { refId: 'B', datasource: { uid: 'loki-1' } },
        ],
      });
      queryRunner.setState({
        data: {
          state: LoadingState.Done,
          series: [],
          timeRange: getDefaultTimeRange(),
          request: {
            app: 'dashboard',
            requestId: 'Q1',
            timezone: 'browser',
            panelId: 1,
            dashboardUID: 'dash-1',
            range: getDefaultTimeRange(),
            interval: '1s',
            intervalMs: 1000,
            targets: [],
            scopedVars: {},
            filters: [{ key: 'prom_label', operator: '=', value: 'prom_val' }],
          } as unknown as DataQueryRequest,
        },
      });

      const lokiVar = new AdHocFiltersVariable({
        name: 'LokiAdHoc',
        datasource: { uid: 'loki-1' },
        filters: [{ key: 'loki_label', operator: '=', value: 'loki_val' }],
      });

      const panel = new VizPanel({
        pluginId: 'timeseries',
        $data: queryRunner,
      });

      new EmbeddedScene({
        $variables: new SceneVariableSet({ variables: [lokiVar] }),
        body: panel,
      });

      const lokiFilters = await getAdhocFiltersForPanel(panel, queryRunner, { uid: 'loki-1' });
      expect(lokiFilters).toEqual([{ key: 'loki_label', operator: '=', value: 'loki_val' }]);
    });

    it('resolves default datasource for queries with omitted datasource on mixed panels in tryGetExploreUrlForPanel', async () => {
      const defaultQuery = { refId: 'A' };
      const lokiQuery = { refId: 'B', datasource: { uid: 'loki-1' } };
      const queryRunner = new SceneQueryRunner({
        datasource: { uid: '-- Mixed --' },
        queries: [defaultQuery, lokiQuery],
      });
      const panel = new VizPanel({
        pluginId: 'timeseries',
        $data: queryRunner,
      });
      panel.getPlugin = () => getPanelPlugin({ skipDataQuery: false });

      const defaultAdhoc = new AdHocFiltersVariable({
        name: 'DefaultFilters',
        datasource: { uid: 'default' },
        filters: [{ key: 'env', operator: '=', value: 'prod' }],
      });
      const lokiAdhoc = new AdHocFiltersVariable({
        name: 'LokiFilters',
        datasource: { uid: 'loki-1' },
        filters: [{ key: 'level', operator: '=', value: 'warn' }],
      });

      new DashboardScene({
        title: 'Mixed With Default',
        uid: 'dash-mixed-default',
        $timeRange: new SceneTimeRange({ from: 'now-1h', to: 'now' }),
        $variables: new SceneVariableSet({
          variables: [defaultAdhoc, lokiAdhoc],
        }),
        body: DefaultGridLayoutManager.fromVizPanels([panel]),
      });

      const mockDefaultInterpolate = jest.fn((queries, scopedVars, filters) => [
        { ...queries[0], interpolatedFilters: filters },
      ]);
      const mockLokiInterpolate = jest.fn((queries, scopedVars, filters) => [
        { ...queries[0], interpolatedFilters: filters },
      ]);

      mockGetDataSourceInstance.mockImplementation(async (ref: unknown) => {
        if (!ref) {
          return { interpolateVariablesInQueries: mockDefaultInterpolate };
        }
        const uid = typeof ref === 'string' ? ref : (ref as { uid?: string })?.uid;
        if (uid === 'default') {
          return { interpolateVariablesInQueries: mockDefaultInterpolate };
        }
        if (uid === 'loki-1') {
          return { interpolateVariablesInQueries: mockLokiInterpolate };
        }
        return undefined;
      });

      await tryGetExploreUrlForPanel(panel);

      expect(mockDefaultInterpolate).toHaveBeenCalledWith(
        [defaultQuery],
        expect.anything(),
        [{ key: 'env', operator: '=', value: 'prod' }]
      );
      expect(mockLokiInterpolate).toHaveBeenCalledWith(
        [lokiQuery],
        expect.anything(),
        [{ key: 'level', operator: '=', value: 'warn' }]
      );
    });
  });
});


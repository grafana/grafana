import { DataSourceApi, MetricFindValue } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import {
  AdHocFiltersVariable,
  EmbeddedScene,
  GroupByVariable,
  SceneTimeRange,
  SceneVariableSet,
} from '@grafana/scenes';

import { getAdHocTagKeysProvider, getAdHocTagValuesProvider, getGroupByTagKeysProvider } from './tagKeysProviders';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: jest.fn(),
  // AdHocFiltersVariable constructor calls getTemplateSrv().getAdhocFilters to patch it.
  // Without this stub it logs "Failed to patch getAdhocFilters".
  getTemplateSrv: () => ({ getAdhocFilters: jest.fn().mockReturnValue([]) }),
}));

const getDataSourceSrvMock = jest.mocked(getDataSourceSrv);

function mockGetDataSourceSrv(dsOverrides: Partial<DataSourceApi> & { getResource?: jest.Mock } = {}) {
  getDataSourceSrvMock.mockReturnValue({
    get: async () => dsOverrides as DataSourceApi,
  } as ReturnType<typeof getDataSourceSrv>);
}

function activateWithScene(variable: GroupByVariable | AdHocFiltersVariable) {
  const scene = new EmbeddedScene({
    $timeRange: new SceneTimeRange({ from: 'now-1h', to: 'now' }),
    $variables: new SceneVariableSet({ variables: [variable] }),
    body: undefined as never,
  });
  scene.activate();
}

describe('tagKeysProviders', () => {
  describe('getGroupByTagKeysProvider', () => {
    it('should show promoted labels first, frequent labels, then remaining sorted under All', async () => {
      mockGetDataSourceSrv({
        getTagKeys: jest.fn().mockResolvedValue([
          { text: 'severity', value: 'severity' },
          { text: 'grafana_folder', value: 'grafana_folder' },
          { text: '__name__', value: '__name__' },
          { text: 'team', value: 'team' },
          { text: 'region', value: 'region' },
        ] satisfies MetricFindValue[]),
        getResource: jest.fn().mockResolvedValue({
          data: [
            { __name__: 'GRAFANA_ALERTS', alertname: 'r1', team: 'platform', severity: 'critical' },
            { __name__: 'GRAFANA_ALERTS', alertname: 'r2', team: 'infra', region: 'eu' },
            { __name__: 'GRAFANA_ALERTS', alertname: 'r3', team: 'platform' },
          ],
        }),
      });

      const variable = new GroupByVariable({ name: 'groupBy', datasource: { uid: 'test' } });
      activateWithScene(variable);

      const result = await getGroupByTagKeysProvider(variable, null);

      expect(result.replace).toBe(true);
      expect(result.values).toEqual([
        { value: 'grafana_folder', text: 'Folder', group: 'Common' },
        // team appears in 3 series, severity in 1, region in 1
        { value: 'team', text: 'team', group: 'Frequent' },
        { value: 'severity', text: 'severity', group: 'Frequent' },
        { value: 'region', text: 'region', group: 'Frequent' },
      ]);
    });

    it('should return only promoted labels when DS returns no extra keys', async () => {
      mockGetDataSourceSrv({
        getTagKeys: jest.fn().mockResolvedValue([] satisfies MetricFindValue[]),
        getResource: jest.fn().mockResolvedValue({ data: [] }),
      });

      const variable = new GroupByVariable({ name: 'groupBy', datasource: { uid: 'test' } });
      activateWithScene(variable);

      const result = await getGroupByTagKeysProvider(variable, null);

      expect(result.values).toEqual([{ value: 'grafana_folder', text: 'Folder', group: 'Common' }]);
    });
  });

  describe('getAdHocTagKeysProvider', () => {
    it('should show promoted labels first, frequent labels, then remaining sorted under All', async () => {
      mockGetDataSourceSrv({
        getTagKeys: jest.fn().mockResolvedValue([
          { text: 'alertstate', value: 'alertstate' },
          { text: 'alertname', value: 'alertname' },
          { text: 'grafana_folder', value: 'grafana_folder' },
          { text: 'severity', value: 'severity' },
          { text: '__name__', value: '__name__' },
          { text: 'team', value: 'team' },
          { text: 'env', value: 'env' },
        ] satisfies MetricFindValue[]),
        getResource: jest.fn().mockResolvedValue({
          data: [
            {
              __name__: 'GRAFANA_ALERTS',
              alertname: 'r1',
              alertstate: 'firing',
              team: 'platform',
              severity: 'critical',
            },
            { __name__: 'GRAFANA_ALERTS', alertname: 'r2', alertstate: 'firing', team: 'infra', env: 'prod' },
            { __name__: 'GRAFANA_ALERTS', alertname: 'r3', alertstate: 'pending', team: 'platform' },
          ],
        }),
      });

      const variable = new AdHocFiltersVariable({ name: 'filters', datasource: { uid: 'test' } });
      activateWithScene(variable);

      const result = await getAdHocTagKeysProvider(variable, null);

      expect(result.replace).toBe(true);
      expect(result.values).toEqual([
        { value: 'alertstate', text: 'State', group: 'Common' },
        { value: 'alertname', text: 'Rule name', group: 'Common' },
        { value: 'grafana_folder', text: 'Folder', group: 'Common' },
        // team (3), severity (1), env (1) — alertstate/alertname excluded as internal
        { value: 'team', text: 'team', group: 'Frequent' },
        { value: 'severity', text: 'severity', group: 'Frequent' },
        { value: 'env', text: 'env', group: 'Frequent' },
      ]);
    });

    it('should not duplicate promoted labels in Frequent group', async () => {
      mockGetDataSourceSrv({
        getTagKeys: jest.fn().mockResolvedValue([
          { text: 'alertstate', value: 'alertstate' },
          { text: 'team', value: 'team' },
        ] satisfies MetricFindValue[]),
        // alertstate is promoted AND would be frequent, but INTERNAL_LABELS excludes it from counting
        getResource: jest.fn().mockResolvedValue({
          data: [{ __name__: 'GRAFANA_ALERTS', alertstate: 'firing', team: 'platform' }],
        }),
      });

      const variable = new AdHocFiltersVariable({ name: 'filters', datasource: { uid: 'test' } });
      activateWithScene(variable);

      const result = await getAdHocTagKeysProvider(variable, null);

      const frequentValues = result.values.filter((v) => v.group === 'Frequent');
      expect(frequentValues).toEqual([{ value: 'team', text: 'team', group: 'Frequent' }]);
    });
  });

  describe('getAdHocTagValuesProvider', () => {
    it('should return values from datasource', async () => {
      const tagValues: MetricFindValue[] = [{ text: 'firing' }, { text: 'pending' }];
      mockGetDataSourceSrv({
        getTagValues: jest.fn().mockResolvedValue(tagValues),
      });

      const variable = new AdHocFiltersVariable({ name: 'filters', datasource: { uid: 'test' } });
      activateWithScene(variable);

      const result = await getAdHocTagValuesProvider(variable, { key: 'alertstate', operator: '=', value: '' });

      expect(result.replace).toBe(true);
      expect(result.values).toEqual(tagValues);
    });
  });

  describe('edge cases', () => {
    it('should return promoted labels only when DS lacks getTagKeys and getResource', async () => {
      mockGetDataSourceSrv({});

      const variable = new GroupByVariable({ name: 'groupBy', datasource: { uid: 'test' } });
      activateWithScene(variable);

      const result = await getGroupByTagKeysProvider(variable, null);

      expect(result.values).toEqual([{ value: 'grafana_folder', text: 'Folder', group: 'Common' }]);
    });

    it('should skip Frequent group when getResource is unavailable', async () => {
      mockGetDataSourceSrv({
        getTagKeys: jest.fn().mockResolvedValue([{ text: 'team', value: 'team' }] satisfies MetricFindValue[]),
        // no getResource
      });

      const variable = new GroupByVariable({ name: 'groupBy', datasource: { uid: 'test' } });
      activateWithScene(variable);

      const result = await getGroupByTagKeysProvider(variable, null);

      expect(result.values).toEqual([
        { value: 'grafana_folder', text: 'Folder', group: 'Common' },
        { text: 'team', value: 'team', group: 'All' },
      ]);
    });
  });
});

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

function mockGetDataSourceSrv(dsOverrides: Partial<DataSourceApi> = {}) {
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
    it('should show promoted labels first and remaining sorted under All', async () => {
      mockGetDataSourceSrv({
        getTagKeys: jest.fn().mockResolvedValue([
          { text: 'severity', value: 'severity' },
          { text: 'grafana_folder', value: 'grafana_folder' },
          { text: '__name__', value: '__name__' },
          { text: 'team', value: 'team' },
        ] satisfies MetricFindValue[]),
      });

      const variable = new GroupByVariable({ name: 'groupBy', datasource: { uid: 'test' } });
      activateWithScene(variable);

      const result = await getGroupByTagKeysProvider(variable, null);

      expect(result.replace).toBe(true);
      expect(result.values).toEqual([
        { value: 'grafana_folder', text: 'Folder', group: 'Common' },
        { text: 'severity', value: 'severity', group: 'All' },
        { text: 'team', value: 'team', group: 'All' },
      ]);
    });

    it('should return only promoted labels when DS returns no extra keys', async () => {
      mockGetDataSourceSrv({
        getTagKeys: jest.fn().mockResolvedValue([] satisfies MetricFindValue[]),
      });

      const variable = new GroupByVariable({ name: 'groupBy', datasource: { uid: 'test' } });
      activateWithScene(variable);

      const result = await getGroupByTagKeysProvider(variable, null);

      expect(result.values).toEqual([{ value: 'grafana_folder', text: 'Folder', group: 'Common' }]);
    });
  });

  describe('getAdHocTagKeysProvider', () => {
    it('should show promoted labels first and remaining sorted under All', async () => {
      mockGetDataSourceSrv({
        getTagKeys: jest.fn().mockResolvedValue([
          { text: 'alertstate', value: 'alertstate' },
          { text: 'alertname', value: 'alertname' },
          { text: 'grafana_folder', value: 'grafana_folder' },
          { text: 'severity', value: 'severity' },
          { text: '__name__', value: '__name__' },
          { text: 'team', value: 'team' },
        ] satisfies MetricFindValue[]),
      });

      const variable = new AdHocFiltersVariable({ name: 'filters', datasource: { uid: 'test' } });
      activateWithScene(variable);

      const result = await getAdHocTagKeysProvider(variable, null);

      expect(result.replace).toBe(true);
      expect(result.values).toEqual([
        { value: 'alertstate', text: 'State', group: 'Common' },
        { value: 'alertname', text: 'Rule name', group: 'Common' },
        { value: 'grafana_folder', text: 'Folder', group: 'Common' },
        { text: 'severity', value: 'severity', group: 'All' },
        { text: 'team', value: 'team', group: 'All' },
      ]);
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
    it('should return promoted labels only when DS lacks getTagKeys', async () => {
      mockGetDataSourceSrv({});

      const variable = new GroupByVariable({ name: 'groupBy', datasource: { uid: 'test' } });
      activateWithScene(variable);

      const result = await getGroupByTagKeysProvider(variable, null);

      expect(result.values).toEqual([{ value: 'grafana_folder', text: 'Folder', group: 'Common' }]);
    });
  });
});

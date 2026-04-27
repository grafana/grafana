import type { DataSourceApi, MetricFindValue } from '@grafana/data/types';
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
          { text: 'cluster_name', value: 'cluster_name' },
          { text: 'exported_namespace', value: 'exported_namespace' },
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
        { value: 'cluster', text: 'Cluster', group: 'Common' },
        { value: 'namespace', text: 'Namespace', group: 'Common' },
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

      expect(result.values).toEqual([
        { value: 'grafana_folder', text: 'Folder', group: 'Common' },
        { value: 'cluster', text: 'Cluster', group: 'Common' },
        { value: 'namespace', text: 'Namespace', group: 'Common' },
      ]);
    });
  });

  describe('getAdHocTagKeysProvider', () => {
    it('should return all labels sorted under All', async () => {
      mockGetDataSourceSrv({
        getTagKeys: jest.fn().mockResolvedValue([
          { text: 'alertstate', value: 'alertstate' },
          { text: 'alertname', value: 'alertname' },
          { text: 'grafana_folder', value: 'grafana_folder' },
          { text: 'cluster_name', value: 'cluster_name' },
          { text: 'exported_namespace', value: 'exported_namespace' },
          { text: 'namespace_extracted', value: 'namespace_extracted' },
          { text: 'severity', value: 'severity' },
          { text: 'environment', value: 'environment' },
          { text: '__name__', value: '__name__' },
          { text: 'team', value: 'team' },
        ] satisfies MetricFindValue[]),
      });

      const variable = new AdHocFiltersVariable({ name: 'filters', datasource: { uid: 'test' } });
      activateWithScene(variable);

      const result = await getAdHocTagKeysProvider(variable, null);

      expect(result.replace).toBe(true);
      expect(result.values).toEqual(
        expect.arrayContaining([
          { text: 'alertstate', value: 'alertstate', group: 'All' },
          { text: 'alertname', value: 'alertname', group: 'All' },
          { text: 'grafana_folder', value: 'grafana_folder', group: 'All' },
          { text: 'environment', value: 'environment', group: 'All' },
          { text: 'severity', value: 'severity', group: 'All' },
          { text: 'team', value: 'team', group: 'All' },
        ])
      );
      expect(result.values).not.toEqual(expect.arrayContaining([expect.objectContaining({ group: 'Common' })]));
      expect(result.values).not.toEqual(
        expect.arrayContaining([
          { value: 'service', text: 'Service', group: 'Common' },
          { text: 'Team', value: 'team', group: 'Common' },
          { text: 'Namespace', value: 'namespace', group: 'Common' },
        ])
      );
      expect(result.values).not.toEqual(expect.arrayContaining([{ text: 'service', value: 'service', group: 'All' }]));
      expect(result.values).not.toEqual(
        expect.arrayContaining([{ text: 'service_name', value: 'service_name', group: 'All' }])
      );
      expect(result.values).not.toEqual(
        expect.arrayContaining([{ text: 'cluster_name', value: 'cluster_name', group: 'All' }])
      );
      expect(result.values).not.toEqual(
        expect.arrayContaining([{ text: 'exported_namespace', value: 'exported_namespace', group: 'All' }])
      );
      expect(result.values).not.toEqual(
        expect.arrayContaining([{ text: 'namespace_extracted', value: 'namespace_extracted', group: 'All' }])
      );
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

    it('merges and deduplicates values for combined service key', async () => {
      const getTagValues = jest.fn().mockImplementation(({ key }: { key: string }) => {
        if (key === 'service') {
          return [
            { text: 'payments', value: 'payments' },
            { text: 'checkout', value: 'checkout' },
          ];
        }
        if (key === 'service_name') {
          return [
            { text: 'payments', value: 'payments' },
            { text: 'api', value: 'api' },
          ];
        }
        return [];
      });

      mockGetDataSourceSrv({ getTagValues });

      const variable = new AdHocFiltersVariable({ name: 'filters', datasource: { uid: 'test' } });
      activateWithScene(variable);

      const result = await getAdHocTagValuesProvider(variable, {
        key: 'service',
        operator: '=',
        value: '',
      });

      expect(result.replace).toBe(true);
      expect(result.values).toEqual([
        { text: 'api', value: 'api' },
        { text: 'checkout', value: 'checkout' },
        { text: 'payments', value: 'payments' },
      ]);
    });

    it('merges and deduplicates values for combined cluster key', async () => {
      const getTagValues = jest.fn().mockImplementation(({ key }: { key: string }) => {
        if (key === 'cluster') {
          return [
            { text: 'prod-a', value: 'prod-a' },
            { text: 'prod-b', value: 'prod-b' },
          ];
        }
        if (key === 'cluster_name') {
          return [
            { text: 'prod-a', value: 'prod-a' },
            { text: 'prod-c', value: 'prod-c' },
          ];
        }
        return [];
      });

      mockGetDataSourceSrv({ getTagValues });

      const variable = new AdHocFiltersVariable({ name: 'filters', datasource: { uid: 'test' } });
      activateWithScene(variable);

      const result = await getAdHocTagValuesProvider(variable, {
        key: 'cluster',
        operator: '=',
        value: '',
      });

      expect(result.replace).toBe(true);
      expect(result.values).toEqual([
        { text: 'prod-a', value: 'prod-a' },
        { text: 'prod-b', value: 'prod-b' },
        { text: 'prod-c', value: 'prod-c' },
      ]);
    });

    it('merges and deduplicates values for combined namespace key', async () => {
      const getTagValues = jest.fn().mockImplementation(({ key }: { key: string }) => {
        if (key === 'namespace') {
          return [
            { text: 'payments', value: 'payments' },
            { text: 'checkout', value: 'checkout' },
          ];
        }
        if (key === 'exported_namespace') {
          return [
            { text: 'checkout', value: 'checkout' },
            { text: 'identity', value: 'identity' },
          ];
        }
        if (key === 'namespace_extracted') {
          return [
            { text: 'payments', value: 'payments' },
            { text: 'observability', value: 'observability' },
          ];
        }
        return [];
      });

      mockGetDataSourceSrv({ getTagValues });

      const variable = new AdHocFiltersVariable({ name: 'filters', datasource: { uid: 'test' } });
      activateWithScene(variable);

      const result = await getAdHocTagValuesProvider(variable, {
        key: 'namespace',
        operator: '=',
        value: '',
      });

      expect(result.replace).toBe(true);
      expect(result.values).toEqual([
        { text: 'checkout', value: 'checkout' },
        { text: 'identity', value: 'identity' },
        { text: 'observability', value: 'observability' },
        { text: 'payments', value: 'payments' },
      ]);
    });

    it('merges and deduplicates values for combined severity key', async () => {
      const getTagValues = jest.fn().mockImplementation(({ key }: { key: string }) => {
        if (key === 'severity') {
          return [{ text: 'critical', value: 'critical' }];
        }
        if (key === 'priority') {
          return [{ text: 'P1', value: 'P1' }];
        }
        if (key === 'loglevel') {
          return [{ text: 'critical', value: 'critical' }];
        }
        return [];
      });

      mockGetDataSourceSrv({ getTagValues });

      const variable = new AdHocFiltersVariable({ name: 'filters', datasource: { uid: 'test' } });
      activateWithScene(variable);

      const result = await getAdHocTagValuesProvider(variable, {
        key: 'severity',
        operator: '=',
        value: '',
      });

      expect(result.replace).toBe(true);
      expect(result.values).toEqual([
        { text: 'critical', value: 'critical' },
        { text: 'P1', value: 'P1' },
      ]);
    });
  });

  describe('edge cases', () => {
    it('should return promoted labels only when DS lacks getTagKeys', async () => {
      mockGetDataSourceSrv({});

      const variable = new GroupByVariable({ name: 'groupBy', datasource: { uid: 'test' } });
      activateWithScene(variable);

      const result = await getGroupByTagKeysProvider(variable, null);

      expect(result.values).toEqual([
        { value: 'grafana_folder', text: 'Folder', group: 'Common' },
        { value: 'cluster', text: 'Cluster', group: 'Common' },
        { value: 'namespace', text: 'Namespace', group: 'Common' },
      ]);
    });
  });
});

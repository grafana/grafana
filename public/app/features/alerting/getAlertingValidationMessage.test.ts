import { DataSourceSrv } from '@grafana/runtime';
import { DataSourceApi, PluginMeta, DataTransformerConfig } from '@grafana/data';

import { ElasticsearchQuery } from '../../plugins/datasource/elasticsearch/types';
import { getAlertingValidationMessage } from './getAlertingValidationMessage';

describe('getAlertingValidationMessage', () => {
  describe('when called with some targets containing template variables', () => {
    it('then it should return false', async () => {
      let call = 0;
      const datasource: DataSourceApi = ({
        meta: ({ alerting: true } as any) as PluginMeta,
        targetContainsTemplate: () => {
          if (call === 0) {
            call++;
            return true;
          }
          return false;
        },
        name: 'some name',
      } as any) as DataSourceApi;
      const getMock = jest.fn().mockResolvedValue(datasource);
      const datasourceSrv: DataSourceSrv = {
        get: getMock,
        getDataSourceSettingsByUid(): any {},
      };
      const targets: ElasticsearchQuery[] = [
        { refId: 'A', query: '@hostname:$hostname', isLogsQuery: false },
        { refId: 'B', query: '@instance:instance', isLogsQuery: false },
      ];
      const transformations: DataTransformerConfig[] = [];

      const result = await getAlertingValidationMessage(transformations, targets, datasourceSrv, datasource.name);

      expect(result).toBe('');
      expect(getMock).toHaveBeenCalledTimes(2);
      expect(getMock).toHaveBeenCalledWith(datasource.name);
    });
  });

  describe('when called with some targets using a datasource that does not support alerting', () => {
    it('then it should return false', async () => {
      const alertingDatasource: DataSourceApi = ({
        meta: ({ alerting: true } as any) as PluginMeta,
        targetContainsTemplate: () => false,
        name: 'alertingDatasource',
      } as any) as DataSourceApi;
      const datasource: DataSourceApi = ({
        meta: ({ alerting: false } as any) as PluginMeta,
        targetContainsTemplate: () => false,
        name: 'datasource',
      } as any) as DataSourceApi;

      const datasourceSrv: DataSourceSrv = {
        get: (name: string) => {
          if (name === datasource.name) {
            return Promise.resolve(datasource);
          }

          return Promise.resolve(alertingDatasource);
        },
        getDataSourceSettingsByUid(): any {},
      };
      const targets: any[] = [
        { refId: 'A', query: 'some query', datasource: 'alertingDatasource' },
        { refId: 'B', query: 'some query', datasource: 'datasource' },
      ];
      const transformations: DataTransformerConfig[] = [];

      const result = await getAlertingValidationMessage(transformations, targets, datasourceSrv, datasource.name);

      expect(result).toBe('');
    });
  });

  describe('when called with all targets containing template variables', () => {
    it('then it should return false', async () => {
      const datasource: DataSourceApi = ({
        meta: ({ alerting: true } as any) as PluginMeta,
        targetContainsTemplate: () => true,
        name: 'some name',
      } as any) as DataSourceApi;
      const getMock = jest.fn().mockResolvedValue(datasource);
      const datasourceSrv: DataSourceSrv = {
        get: getMock,
        getDataSourceSettingsByUid(): any {},
      };
      const targets: ElasticsearchQuery[] = [
        { refId: 'A', query: '@hostname:$hostname', isLogsQuery: false },
        { refId: 'B', query: '@instance:$instance', isLogsQuery: false },
      ];
      const transformations: DataTransformerConfig[] = [];

      const result = await getAlertingValidationMessage(transformations, targets, datasourceSrv, datasource.name);

      expect(result).toBe('Template variables are not supported in alert queries');
      expect(getMock).toHaveBeenCalledTimes(2);
      expect(getMock).toHaveBeenCalledWith(datasource.name);
    });
  });

  describe('when called with all targets using a datasource that does not support alerting', () => {
    it('then it should return false', async () => {
      const datasource: DataSourceApi = ({
        meta: ({ alerting: false } as any) as PluginMeta,
        targetContainsTemplate: () => false,
        name: 'some name',
      } as any) as DataSourceApi;
      const getMock = jest.fn().mockResolvedValue(datasource);
      const datasourceSrv: DataSourceSrv = {
        get: getMock,
        getDataSourceSettingsByUid(): any {},
      };
      const targets: ElasticsearchQuery[] = [
        { refId: 'A', query: '@hostname:hostname', isLogsQuery: false },
        { refId: 'B', query: '@instance:instance', isLogsQuery: false },
      ];
      const transformations: DataTransformerConfig[] = [];

      const result = await getAlertingValidationMessage(transformations, targets, datasourceSrv, datasource.name);

      expect(result).toBe('The datasource does not support alerting queries');
      expect(getMock).toHaveBeenCalledTimes(2);
      expect(getMock).toHaveBeenCalledWith(datasource.name);
    });
  });

  describe('when called with transformations', () => {
    it('then it should return false', async () => {
      const datasource: DataSourceApi = ({
        meta: ({ alerting: true } as any) as PluginMeta,
        targetContainsTemplate: () => false,
        name: 'some name',
      } as any) as DataSourceApi;
      const getMock = jest.fn().mockResolvedValue(datasource);
      const datasourceSrv: DataSourceSrv = {
        get: getMock,
        getDataSourceSettingsByUid(): any {},
      };
      const targets: ElasticsearchQuery[] = [
        { refId: 'A', query: '@hostname:hostname', isLogsQuery: false },
        { refId: 'B', query: '@instance:instance', isLogsQuery: false },
      ];
      const transformations: DataTransformerConfig[] = [{ id: 'A', options: null }];

      const result = await getAlertingValidationMessage(transformations, targets, datasourceSrv, datasource.name);

      expect(result).toBe('Transformations are not supported in alert queries');
      expect(getMock).toHaveBeenCalledTimes(0);
    });
  });
});

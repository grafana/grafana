import {
  DataSourceApi,
  PluginMeta,
  DataTransformerConfig,
  DataSourceInstanceSettings,
  DataSourceRef,
} from '@grafana/data';
import { DataSourceSrv } from '@grafana/runtime';

import { ElasticsearchQuery } from '../../plugins/datasource/elasticsearch/types';

import { getAlertingValidationMessage } from './getAlertingValidationMessage';

describe('getAlertingValidationMessage', () => {
  describe('when called with some targets containing template variables', () => {
    it('then it should return false', async () => {
      let call = 0;
      const datasource: DataSourceApi = {
        meta: { alerting: true } as unknown as PluginMeta,
        targetContainsTemplate: () => {
          if (call === 0) {
            call++;
            return true;
          }
          return false;
        },
        name: 'some name',
        uid: 'some uid',
      } as unknown as DataSourceApi;
      const getMock = jest.fn().mockResolvedValue(datasource);
      const datasourceSrv: DataSourceSrv = {
        get: (ref: DataSourceRef) => {
          return getMock(ref.uid);
        },
        getList(): DataSourceInstanceSettings[] {
          return [];
        },
        getInstanceSettings: (() => {}) as any,
        reload: () => jest.fn(),
      };
      const targets: ElasticsearchQuery[] = [
        { refId: 'A', query: '@hostname:$hostname' },
        { refId: 'B', query: '@instance:instance' },
      ];
      const transformations: DataTransformerConfig[] = [];

      const result = await getAlertingValidationMessage(transformations, targets, datasourceSrv, {
        uid: datasource.uid,
      });

      expect(result).toBe('');
      expect(getMock).toHaveBeenCalledTimes(2);
      expect(getMock).toHaveBeenCalledWith(datasource.uid);
    });
  });

  describe('when called with some targets using a datasource that does not support alerting', () => {
    it('then it should return false', async () => {
      const alertingDatasource: DataSourceApi = {
        meta: { alerting: true } as unknown as PluginMeta,
        targetContainsTemplate: () => false,
        name: 'alertingDatasource',
      } as unknown as DataSourceApi;
      const datasource: DataSourceApi = {
        meta: { alerting: false } as unknown as PluginMeta,
        targetContainsTemplate: () => false,
        name: 'datasource',
      } as unknown as DataSourceApi;

      const datasourceSrv: DataSourceSrv = {
        get: (name: string) => {
          if (name === datasource.name) {
            return Promise.resolve(datasource);
          }

          return Promise.resolve(alertingDatasource);
        },
        getInstanceSettings: (() => {}) as any,
        getList(): DataSourceInstanceSettings[] {
          return [];
        },
        reload: () => jest.fn(),
      };
      const targets: any[] = [
        { refId: 'A', query: 'some query', datasource: 'alertingDatasource' },
        { refId: 'B', query: 'some query', datasource: 'datasource' },
      ];
      const transformations: DataTransformerConfig[] = [];

      const result = await getAlertingValidationMessage(transformations, targets, datasourceSrv, {
        uid: datasource.name,
      });

      expect(result).toBe('');
    });
  });

  describe('when called with all targets containing template variables', () => {
    it('then it should return false', async () => {
      const datasource: DataSourceApi = {
        meta: { alerting: true } as unknown as PluginMeta,
        targetContainsTemplate: () => true,
        name: 'some name',
      } as unknown as DataSourceApi;
      const getMock = jest.fn().mockResolvedValue(datasource);
      const datasourceSrv: DataSourceSrv = {
        get: (ref: DataSourceRef) => {
          return getMock(ref.uid);
        },
        getInstanceSettings: (() => {}) as any,
        getList(): DataSourceInstanceSettings[] {
          return [];
        },
        reload: () => jest.fn(),
      };
      const targets: ElasticsearchQuery[] = [
        { refId: 'A', query: '@hostname:$hostname' },
        { refId: 'B', query: '@instance:$instance' },
      ];
      const transformations: DataTransformerConfig[] = [];

      const result = await getAlertingValidationMessage(transformations, targets, datasourceSrv, {
        uid: datasource.name,
      });

      expect(result).toBe('Template variables are not supported in alert queries');
      expect(getMock).toHaveBeenCalledTimes(2);
      expect(getMock).toHaveBeenCalledWith(datasource.name);
    });
  });

  describe('when called with all targets using a datasource that does not support alerting', () => {
    it('then it should return false', async () => {
      const datasource: DataSourceApi = {
        meta: { alerting: false } as unknown as PluginMeta,
        targetContainsTemplate: () => false,
        name: 'some name',
        uid: 'theid',
      } as unknown as DataSourceApi;
      const getMock = jest.fn().mockResolvedValue(datasource);
      const datasourceSrv: DataSourceSrv = {
        get: (ref: DataSourceRef) => {
          return getMock(ref.uid);
        },
        getInstanceSettings: (() => {}) as any,
        getList(): DataSourceInstanceSettings[] {
          return [];
        },
        reload: () => jest.fn(),
      };
      const targets: ElasticsearchQuery[] = [
        { refId: 'A', query: '@hostname:hostname' },
        { refId: 'B', query: '@instance:instance' },
      ];
      const transformations: DataTransformerConfig[] = [];

      const result = await getAlertingValidationMessage(transformations, targets, datasourceSrv, {
        uid: datasource.uid,
      });

      expect(result).toBe('The datasource does not support alerting queries');
      expect(getMock).toHaveBeenCalledTimes(2);
      expect(getMock).toHaveBeenCalledWith(datasource.uid);
    });
  });

  describe('when called with transformations', () => {
    it('then it should return false', async () => {
      const datasource: DataSourceApi = {
        meta: { alerting: true } as unknown as PluginMeta,
        targetContainsTemplate: () => false,
        name: 'some name',
      } as unknown as DataSourceApi;
      const getMock = jest.fn().mockResolvedValue(datasource);
      const datasourceSrv: DataSourceSrv = {
        get: (ref: DataSourceRef) => {
          return getMock(ref.uid);
        },
        getInstanceSettings: (() => {}) as any,
        getList(): DataSourceInstanceSettings[] {
          return [];
        },
        reload: () => jest.fn(),
      };
      const targets: ElasticsearchQuery[] = [
        { refId: 'A', query: '@hostname:hostname' },
        { refId: 'B', query: '@instance:instance' },
      ];
      const transformations: DataTransformerConfig[] = [{ id: 'A', options: null }];

      const result = await getAlertingValidationMessage(transformations, targets, datasourceSrv, {
        uid: datasource.uid,
      });

      expect(result).toBe('Transformations are not supported in alert queries');
      expect(getMock).toHaveBeenCalledTimes(0);
    });
  });
});

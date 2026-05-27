import { of } from 'rxjs';

import { type DataSourceSettings } from '@grafana/data';
import { type BackendSrvRequest, type FetchResponse } from '@grafana/runtime';
import { getBackendSrv } from 'app/core/services/backend_srv';

import {
  getDataSourceByUid,
  deleteDataSource,
  convertK8sDatasourceSettingsToLegacyDatasourceSettings,
  convertLegacyDatasourceSettingsToK8sDatasourceSettings,
  type DataSourceSettingsK8s,
  type K8sMetadata,
  type DatasourceInstanceK8sSpec,
} from './api';

jest.mock('app/core/services/backend_srv');
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: jest.fn(),
}));

const mockResponse = (response: Partial<FetchResponse>) => {
  (getBackendSrv as jest.Mock).mockReturnValueOnce({
    fetch: (options: BackendSrvRequest) => {
      return of(response as FetchResponse);
    },
  });
};

describe('Datasources / API', () => {
  describe('getDataSourceByUid()', () => {
    it('should resolve to the datasource object in case it is fetched using a UID', async () => {
      const response = {
        ok: true,
        data: {
          id: 111,
          uid: 'abcdefg',
        },
      };
      mockResponse(response);

      expect(await getDataSourceByUid(response.data.uid)).toBe(response.data);
    });
  });
  describe('convertK8sDatasourceSettingsToLegacyDatasourceSettings()', () => {
    it('should convert k8s datasource to legacy datasource', () => {
      let dsLegacySettings: DataSourceSettings = {
        id: 42,
        uid: 'fortytwo',
        orgId: 1,
        name: 'slartybartfast',
        typeLogoUrl: '',
        type: 'marvin',
        typeName: '',
        access: 'all areas',
        url: 'example.com',
        user: 'zaphod',
        database: 'universe',
        basicAuth: true,
        basicAuthUser: 'zaphod',
        isDefault: true,
        jsonData: { authType: 'bar' },
        secureJsonFields: {
          basicAuthPassword: true,
        },
        readOnly: true,
        withCredentials: false,
      };

      let k8sMetadata: K8sMetadata = {
        name: 'fortytwo',
        namespace: 'default',
        uid: 'fortytwo',
        resourceVersion: '',
        generation: 42,
        creationTimestamp: '1234',
        labels: { 'grafana.app/deprecatedInternalID': '42' },
        annotations: {},
      };
      let k8sSpec: DatasourceInstanceK8sSpec = {
        access: 'all areas',
        jsonData: { authType: 'bar' },
        title: 'slartybartfast',
        url: 'example.com',
        basicAuth: true,
        basicAuthUser: 'zaphod',
        user: 'zaphod',
        database: 'universe',
        isDefault: true,
        readOnly: true,
      };
      let dsK8sSettings: DataSourceSettingsK8s = {
        kind: 'DataSource',
        metadata: k8sMetadata,
        spec: k8sSpec,
        apiVersion: 'marvin.datasource.grafana.app/v0alpha1',
        secure: { basicAuthPassword: { foo: 'bar' } },
      };
      expect(convertK8sDatasourceSettingsToLegacyDatasourceSettings(dsK8sSettings)).toEqual(dsLegacySettings);
    });
  });

  describe('deleteDataSource()', () => {
    it('should return the result of the delete request', async () => {
      const deleteResult = { message: 'Data source deleted' };
      const deleteFn = jest.fn().mockResolvedValue(deleteResult);
      (getBackendSrv as jest.Mock).mockReturnValueOnce({ delete: deleteFn });

      const result = await deleteDataSource('abc123');

      expect(deleteFn).toHaveBeenCalledWith('/api/datasources/uid/abc123');
      expect(result).toEqual(deleteResult);
    });
  });

  describe('convertLegacyDatasourceSettingsToK8sDatasourceSettings()', () => {
    it('should convert legacy datasource to k8s datasource', () => {
      let dsLegacySettings: DataSourceSettings = {
        id: 42,
        uid: 'fortytwo',
        orgId: 1,
        name: 'slartybartfast',
        typeLogoUrl: '',
        type: 'marvin',
        typeName: '',
        access: 'all areas',
        url: 'example.com',
        user: 'zaphod',
        database: 'universe',
        basicAuth: true,
        basicAuthUser: 'zaphod',
        isDefault: true,
        jsonData: { authType: 'bar' },
        secureJsonFields: {},
        readOnly: true,
        withCredentials: false,
      };
      let k8sMetadata: K8sMetadata = {
        name: 'fortytwo',
        namespace: 'default',
        resourceVersion: '',
        labels: { 'grafana.app/deprecatedInternalID': '42' },
        annotations: {},
      };
      let k8sSpec: DatasourceInstanceK8sSpec = {
        access: 'all areas',
        jsonData: { authType: 'bar' },
        title: 'slartybartfast',
        url: 'example.com',
        basicAuth: true,
        basicAuthUser: 'zaphod',
        isDefault: true,
        user: 'zaphod',
        database: 'universe',
        readOnly: true,
      };
      let dsK8sSettings: DataSourceSettingsK8s = {
        kind: 'DataSource',
        metadata: k8sMetadata,
        spec: k8sSpec,
        apiVersion: 'marvin.datasource.grafana.app/v0alpha1',
      };
      let k8sNamespace = 'default';
      let k8sVersion = 'v0alpha1';
      expect(
        convertLegacyDatasourceSettingsToK8sDatasourceSettings(dsLegacySettings, k8sNamespace, k8sVersion)
      ).toEqual(dsK8sSettings);
    });
  });
});

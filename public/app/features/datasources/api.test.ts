import { of } from 'rxjs';

import { DataSourceSettings } from '@grafana/data';
import { BackendSrvRequest, FetchResponse } from '@grafana/runtime';
import { getBackendSrv } from 'app/core/services/backend_srv';

import {
  getDataSourceByUid,
  convertK8sDatasourceSettingsToLegacyDatasourceSettings,
  DataSourceSettingsK8s,
  K8sMetadata,
  DatasourceInstanceK8sSpec,
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
        user: '',
        database: '',
        basicAuth: true,
        basicAuthUser: 'zaphod',
        isDefault: true,
        jsonData: { authType: 'bar' },
        secureJsonFields: {},
        readOnly: false,
        withCredentials: false,
      };

      let k8sMetadata: K8sMetadata = {
        name: 'fortytwo',
        namespace: 'default',
        uid: 'fortytwo',
        resourceVersion: 'fortytwo',
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
        isDefault: true,
      };
      let dsK8sSettings: DataSourceSettingsK8s = {
        kind: 'thingie',
        metadata: k8sMetadata,
        spec: k8sSpec,
        apiVersion: 'marvin.datasource.grafana.app/v0alpha1',
      };
      expect(convertK8sDatasourceSettingsToLegacyDatasourceSettings(dsK8sSettings)).toEqual(dsLegacySettings);
    });
  });
});

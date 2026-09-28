import { of } from 'rxjs';

import { type DataSourceInstanceSettings, type DataSourceSettings } from '@grafana/data';
import { config, type BackendSrvRequest, type FetchResponse } from '@grafana/runtime';
import { FlagKeys, getFeatureFlagClient, setDataSourceInstanceSettings } from '@grafana/runtime/internal';
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
jest.mock('@grafana/runtime/internal', () => ({
  ...jest.requireActual('@grafana/runtime/internal'),
  getFeatureFlagClient: jest.fn(),
}));

const mockGetFeatureFlagClient = jest.mocked(getFeatureFlagClient);
const getBooleanValueFn = jest.fn();

// stubCRUDApisEnabled toggles only the new-CRUD-APIs flag; any other flag key
// falls through to the default the caller supplied.
function stubCRUDApisEnabled(enabled: boolean) {
  getBooleanValueFn.mockImplementation((key: string, defaultValue: boolean) =>
    key === FlagKeys.DatasourcesConfigUiUseNewDatasourceCRUDAPIs ? enabled : defaultValue
  );
}

const marvinSettings = {
  id: 42,
  uid: 'abc123',
  name: 'Marvin',
  type: 'marvin',
  access: 'proxy',
  jsonData: {},
  readOnly: false,
  meta: { id: 'marvin' },
} as DataSourceInstanceSettings;

// getDataSourceInstanceList appends -- Grafana -- to most results, so the group
// lookup has to keep excluding built-ins itself.
const grafanaSettings = {
  id: 1,
  uid: '-- Grafana --',
  name: '-- Grafana --',
  type: 'grafana',
  access: 'proxy',
  jsonData: {},
  readOnly: true,
  meta: { id: 'grafana' },
} as DataSourceInstanceSettings;

const mockResponse = (response: Partial<FetchResponse>) => {
  (getBackendSrv as jest.Mock).mockReturnValueOnce({
    fetch: (options: BackendSrvRequest) => {
      return of(response as FetchResponse);
    },
  });
};

// The k8s read path issues two requests (the resource and its /access subresource),
// so responses are picked by URL rather than by call order.
const mockResponsesByUrl = (responses: Record<string, Partial<FetchResponse>>) => {
  const fetch = jest.fn((options: BackendSrvRequest) => of(responses[options.url] as FetchResponse));
  (getBackendSrv as jest.Mock).mockReturnValue({ fetch });
  return fetch;
};

const originalNamespace = config.namespace;

describe('Datasources / API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetFeatureFlagClient.mockReturnValue({ getBooleanValue: getBooleanValueFn } as unknown as ReturnType<
      typeof getFeatureFlagClient
    >);
    stubCRUDApisEnabled(false);
    setDataSourceInstanceSettings({ Marvin: marvinSettings, '-- Grafana --': grafanaSettings }, 'Marvin');
    config.namespace = 'default';
  });

  afterAll(() => {
    config.namespace = originalNamespace;
  });

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

    it('should derive the k8s group from the instance settings when the new CRUD APIs are enabled', async () => {
      stubCRUDApisEnabled(true);
      const base = '/apis/marvin.datasource.grafana.app/v0alpha1/namespaces/default/datasources/abc123';
      const fetch = mockResponsesByUrl({
        [base]: {
          ok: true,
          data: {
            kind: 'DataSource',
            apiVersion: 'marvin.datasource.grafana.app/v0alpha1',
            metadata: { name: 'abc123', resourceVersion: '2' },
            spec: { title: 'Marvin' },
          },
        },
        [`${base}/access`]: { ok: true, data: { Permissions: { 'datasources:read': true } } },
      });

      const result = await getDataSourceByUid('abc123');

      expect(fetch).toHaveBeenCalledWith(expect.objectContaining({ url: base }));
      expect(fetch).toHaveBeenCalledWith(expect.objectContaining({ url: `${base}/access` }));
      expect(result.uid).toBe('abc123');
      expect(result.type).toBe('marvin');
      expect(result.accessControl).toEqual({ 'datasources:read': true });
    });

    it('should reject when the uid is unknown and the new CRUD APIs are enabled', async () => {
      stubCRUDApisEnabled(true);

      await expect(getDataSourceByUid('nope')).rejects.toThrow('Could not find data source group with uid: "nope"');
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
        version: 2,
      };

      let k8sMetadata: K8sMetadata = {
        name: 'fortytwo',
        namespace: 'default',
        uid: 'fortytwo',
        resourceVersion: '2',
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

    it('should default jsonData to an empty object when the apiserver omits it', () => {
      const dsK8sSettings: DataSourceSettingsK8s = {
        kind: 'DataSource',
        metadata: {
          name: 'fortytwo',
          namespace: 'default',
          resourceVersion: '2',
          labels: { 'grafana.app/deprecatedInternalID': '42' },
        },
        spec: {
          access: 'all areas',
          title: 'slartybartfast',
          url: 'example.com',
          basicAuth: false,
          basicAuthUser: '',
          user: '',
          database: '',
        },
        apiVersion: 'marvin.datasource.grafana.app/v0alpha1',
      };

      expect(convertK8sDatasourceSettingsToLegacyDatasourceSettings(dsK8sSettings).jsonData).toEqual({});
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

    it('should delete through the k8s API when the new CRUD APIs are enabled', async () => {
      stubCRUDApisEnabled(true);
      const deleteFn = jest.fn().mockResolvedValue({});
      (getBackendSrv as jest.Mock).mockReturnValueOnce({ delete: deleteFn });

      await deleteDataSource('abc123');

      expect(deleteFn).toHaveBeenCalledWith(
        '/apis/marvin.datasource.grafana.app/v0alpha1/namespaces/default/datasources/abc123'
      );
    });

    it('should reject rather than issue a request with an empty group when the uid is unknown', async () => {
      stubCRUDApisEnabled(true);
      const deleteFn = jest.fn();
      (getBackendSrv as jest.Mock).mockReturnValueOnce({ delete: deleteFn });

      await expect(deleteDataSource('nope')).rejects.toThrow('Could not find data source group with uid: "nope"');
      expect(deleteFn).not.toHaveBeenCalled();
    });

    // A non-uid match would build a k8s URL for the wrong data source.
    it.each([
      ['a name rather than a uid', 'Marvin'],
      ['an id rather than a uid', '42'],
      ['the literal "default"', 'default'],
      ['a built-in data source', '-- Grafana --'],
    ])('should reject when given %s', async (_, uid) => {
      stubCRUDApisEnabled(true);
      const deleteFn = jest.fn();
      (getBackendSrv as jest.Mock).mockReturnValueOnce({ delete: deleteFn });

      await expect(deleteDataSource(uid)).rejects.toThrow(`Could not find data source group with uid: "${uid}"`);
      expect(deleteFn).not.toHaveBeenCalled();
    });
  });

  describe('convertLegacyDatasourceSettingsToK8sDatasourceSettings()', () => {
    it('should convert legacy datasource to k8s datasource', () => {
      let dsLegacySettings: DataSourceSettings = {
        id: 42,
        version: 2,
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
        resourceVersion: '2',
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

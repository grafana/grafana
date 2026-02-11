import { lastValueFrom } from 'rxjs';

import { DataSourceSettings, DataSourceJsonData } from '@grafana/data';
import { config } from '@grafana/runtime';
import { getBackendSrv } from 'app/core/services/backend_srv';
import { accessControlQueryParam } from 'app/core/utils/accessControl';

export const getDataSources = async (): Promise<DataSourceSettings[]> => {
  return await getBackendSrv().get('/api/datasources');
};

export interface K8sMetadata {
  name: string;
  namespace: string;
  uid: string;
  resourceVersion: string;
  generation: number;
  creationTimestamp: string;
  labels: { [key: string]: string };
  annotations: { [key: string]: string };
}

export interface DatasourceInstanceK8sSpec {
  access: string;
  jsonData: DataSourceJsonData;
  title: string;
  url: string;
  basicAuth: boolean;
  basicAuthUser: string;
  isDefault?: boolean;
}

export interface DatasourceAccessK8s {
  kind: string;
  apiVersion: string;
  Permissions: Record<string, boolean>;
}

export interface DataSourceSettingsK8s {
  kind: string;
  apiVersion: string;
  metadata: K8sMetadata;
  spec: DatasourceInstanceK8sSpec;
  secure?: Record<string, Record<string, string>>;
}

export const getDataSourceK8sGroup = (uid: string): string => {
  for (const [key, ds] of Object.entries(config.datasources)) {
    if (key.startsWith('--')) {
      continue;
    }
    if (config.datasources[key].uid === uid) {
      return ds.type + '.datasource.grafana.app';
    }
  }
  return '';
};

export const convertK8sDatasourceSettingsToLegacyDatasourceSettings = (
  dsK8sSettings: DataSourceSettingsK8s
): DataSourceSettings => {
  // TODO: remove this once we figure out what code is using the deprecated
  // id field.
  let id = parseInt(dsK8sSettings.metadata.labels['grafana.app/deprecatedInternalID'] || '', 10);
  let dsSettings: DataSourceSettings = {
    id: id,
    uid: dsK8sSettings.metadata.name,
    orgId: 1,
    name: dsK8sSettings.spec.title,
    typeLogoUrl: '',
    type: dsK8sSettings.apiVersion.replace(/\.datasource\.grafana\.app\/[a-z0-9]+$/, ''),
    typeName: '',
    access: dsK8sSettings.spec.access,
    url: dsK8sSettings.spec.url,
    user: '',
    database: '',
    basicAuth: dsK8sSettings.spec.basicAuth,
    basicAuthUser: dsK8sSettings.spec.basicAuthUser,
    isDefault: dsK8sSettings.spec.isDefault ? true : false,
    jsonData: dsK8sSettings.spec.jsonData,
    secureJsonFields: {},
    readOnly: false,
    withCredentials: false,
  };
  if (dsK8sSettings.secure) {
    for (let k of Object.keys(dsK8sSettings.secure)) {
      dsSettings.secureJsonFields[k] = true;
    }
  }
  return dsSettings;
};

export const getDataSourceFromK8sAPI = async (k8sName: string, namespace: string) => {
  // TODO: read this from backend.
  let k8sVersion = 'v0alpha1';
  let k8sGroup = getDataSourceK8sGroup(k8sName);
  if (k8sGroup === '') {
    throw Error(`Could not find data source group with uid: "${k8sName}"`);
  }

  const response = await lastValueFrom(
    getBackendSrv().fetch<DataSourceSettingsK8s>({
      method: 'GET',
      url: `/apis/${k8sGroup}/${k8sVersion}/namespaces/${namespace}/datasources/${k8sName}`,
      showErrorAlert: false,
    })
  );
  if (!response.ok) {
    throw Error(`Could not find data source by group-version-name: "${k8sGroup}" "${k8sVersion}" "${k8sName}"`);
  }

  let dsSettings = convertK8sDatasourceSettingsToLegacyDatasourceSettings(response.data);
  const accessResponse = await lastValueFrom(
    getBackendSrv().fetch<DatasourceAccessK8s>({
      method: 'GET',
      url: `/apis/${k8sGroup}/${k8sVersion}/namespaces/${namespace}/datasources/${k8sName}/access`,
      showErrorAlert: false,
    })
  );
  if (!accessResponse.ok) {
    throw Error(
      `Could not find data source access information by group-version-name: "${k8sGroup}" "${k8sVersion}" "${k8sName}"`
    );
  }
  dsSettings.accessControl = accessResponse.data.Permissions;
  return dsSettings;
};

export const getDataSourceByUid = async (uid: string) => {
  if (config.featureToggles.queryServiceWithConnections) {
    return getDataSourceFromK8sAPI(uid, config.namespace);
  }

  const response = await lastValueFrom(
    getBackendSrv().fetch<DataSourceSettings>({
      method: 'GET',
      url: `/api/datasources/uid/${uid}`,
      params: accessControlQueryParam(),
      showErrorAlert: false,
    })
  );

  if (response.ok) {
    return response.data;
  }

  throw Error(`Could not find data source by UID: "${uid}"`);
};

export const createDataSource = (dataSource: Partial<DataSourceSettings>) =>
  getBackendSrv().post('/api/datasources', dataSource);

export const getDataSourcePlugins = () => getBackendSrv().get('/api/plugins', { enabled: 1, type: 'datasource' });

export const updateDataSource = (dataSource: DataSourceSettings) => {
  // we're setting showErrorAlert and showSuccessAlert to false to suppress the popover notifications. Request result will now be
  // handled by the data source config page
  return getBackendSrv().put(`/api/datasources/uid/${dataSource.uid}`, dataSource, {
    showErrorAlert: false,
    showSuccessAlert: false,
    validatePath: true,
  });
};

export const deleteDataSource = (uid: string) => getBackendSrv().delete(`/api/datasources/uid/${uid}`);

import {
  type DataSourceInstanceListItem,
  type DataSourceInstanceSettings,
  type DataSourceJsonData,
} from '@grafana/data';

import { config } from '../../config';
import { getBackendSrv } from '../backendSrv';

const DEPRECATED_INTERNAL_ID_LABEL = 'grafana.app/deprecatedInternalID';

interface DataSourceConnection {
  title: string;
  name: string;
  group: string;
  version: string;
  // Raw datasource plugin type used to join the connection with its plugin metadata.
  plugin: string;
}

export interface DataSourceConnectionList {
  items: DataSourceConnection[];
}

export interface DataSourceConnectionDescriptor {
  group: string;
  version: string;
}

interface DataSourceResource {
  apiVersion: string;
  metadata: {
    name?: string;
    labels?: Record<string, string>;
  };
  spec: {
    title: string;
    access?: 'direct' | 'proxy';
    readOnly?: boolean;
    isDefault?: boolean;
    url?: string;
    user?: string;
    database?: string;
    basicAuth?: boolean;
    basicAuthUser?: string;
    withCredentials?: boolean;
    jsonData?: DataSourceJsonData;
  };
}

export function getDataSourceConnectionsUrl(): string {
  return `/apis/query.grafana.app/v0alpha1/namespaces/${config.namespace}/connections`;
}

export async function fetchDataSourceConnections(): Promise<DataSourceConnectionList> {
  return getBackendSrv().get<DataSourceConnectionList>(getDataSourceConnectionsUrl());
}

export function getDataSourceSettingsUrl(uid: string, descriptor: DataSourceConnectionDescriptor): string {
  return `/apis/${descriptor.group}/${descriptor.version}/namespaces/${config.namespace}/datasources/${uid}`;
}

export async function fetchDataSourceSettings(
  item: DataSourceInstanceListItem,
  descriptor: DataSourceConnectionDescriptor
): Promise<DataSourceInstanceSettings> {
  const resource = await getBackendSrv().get<DataSourceResource>(getDataSourceSettingsUrl(item.uid, descriptor));
  return mapDataSourceResource(resource, item);
}

function mapDataSourceResource(
  resource: DataSourceResource,
  item: DataSourceInstanceListItem
): DataSourceInstanceSettings {
  const access = resource.spec.access ?? 'proxy';
  const jsonData: DataSourceJsonData & Record<string, unknown> = { ...(resource.spec.jsonData ?? {}) };
  const database = resource.spec.database ?? '';

  if (['mssql', 'mysql', 'postgres'].includes(item.type) && !jsonData.database) {
    jsonData.database = database;
  }

  if (['prometheus', 'grafana-amazonprometheus-datasource', 'grafana-azureprometheus-datasource'].includes(item.type)) {
    jsonData.directUrl = resource.spec.url ?? '';
  }

  let url = resource.spec.url;
  if (access === 'proxy') {
    url = `/api/datasources/proxy/uid/${item.uid}`;
  } else if (item.type === 'influxdb_08') {
    url = `${url ?? ''}/db/${database}`;
  }

  const id = Number(resource.metadata.labels?.[DEPRECATED_INTERNAL_ID_LABEL]);
  const isInflux = item.type === 'influxdb' || item.type === 'influxdb_08';
  const exposesDatabase = item.type === 'influxdb' || item.type === 'elasticsearch';

  return {
    id: Number.isFinite(id) && id > 0 ? id : undefined,
    uid: resource.metadata.name ?? item.uid,
    type: item.type,
    name: resource.spec.title,
    meta: item.meta,
    readOnly: resource.spec.readOnly ?? false,
    url,
    jsonData,
    username: access === 'direct' && isInflux ? resource.spec.user : undefined,
    database: exposesDatabase ? database : undefined,
    isDefault: resource.spec.isDefault ?? false,
    access,
    withCredentials: access === 'direct' ? resource.spec.withCredentials : undefined,
  };
}

import {
  type DataSourceInstanceListItem,
  type DataSourceInstanceSettings,
  type DataSourceJsonData,
  type DataSourcePluginMeta,
} from '@grafana/data';

import { type DataSourceListSnapshot } from '../types';

import { type DataSourceConnection, type DataSourceResource } from './types';

const GRAFANA_BUILT_IN_UID = 'grafana';
const GRAFANA_BUILT_IN_ID = -1;
const DEPRECATED_INTERNAL_ID_LABEL = 'grafana.app/deprecatedInternalID';

export interface MappedListSnapshot {
  snapshot: DataSourceListSnapshot;
  /** Plugin types of the connections that were dropped because no plugin meta matched. */
  droppedTypes: string[];
}

/** The plugin type stored on a connection. `plugin` is omitted when empty, so derive it from the group. */
export function getConnectionPluginType(connection: DataSourceConnection): string {
  return connection.plugin || connection.group.replace(/\.datasource\.grafana\.app$/, '');
}

/**
 * Join connections with plugin metas into a list snapshot, the way boot data builds its list:
 * - a connection whose plugin has no meta is dropped
 * - `type` is the plugin id, so aliased types are normalized
 * - built-in data sources are synthesized from the metas flagged `builtIn`
 * - the default is the connection labelled `default`, else `-- Grafana --`
 */
export function toListSnapshot(connections: DataSourceConnection[], metas: DataSourcePluginMeta[]): MappedListSnapshot {
  const metaByType = new Map<string, DataSourcePluginMeta>();
  for (const meta of metas) {
    for (const alias of meta.aliasIDs ?? []) {
      metaByType.set(alias, meta);
    }
  }
  // Plugin ids win over aliases.
  for (const meta of metas) {
    metaByType.set(meta.id, meta);
  }

  const items: DataSourceInstanceListItem[] = [];
  const droppedTypes: string[] = [];
  let defaultUid: string | undefined;

  for (const connection of connections) {
    const pluginType = getConnectionPluginType(connection);
    const meta = metaByType.get(pluginType);
    if (!meta) {
      droppedTypes.push(pluginType);
      continue;
    }
    const isDefault = connection.labels?.default === 'true';
    if (isDefault && defaultUid === undefined) {
      defaultUid = connection.name;
    }
    items.push({
      uid: connection.name,
      name: connection.title,
      type: meta.id,
      apiVersion: connection.version,
      meta,
      isDefault,
    });
  }

  const settings: Record<string, DataSourceInstanceSettings> = {};
  const uidById: Record<string, string> = {};
  for (const meta of metas) {
    if (!meta.builtIn) {
      continue;
    }
    const builtIn = toBuiltInSettings(meta);
    items.push({ uid: builtIn.uid, name: builtIn.name, type: builtIn.type, meta, isDefault: false });
    settings[builtIn.uid] = builtIn;
    if (builtIn.id) {
      uidById[String(builtIn.id)] = builtIn.uid;
    }
  }

  if (defaultUid === undefined && settings[GRAFANA_BUILT_IN_UID]) {
    defaultUid = GRAFANA_BUILT_IN_UID;
  }

  return { snapshot: { items, uidById, defaultUid, settings }, droppedTypes };
}

// Mirrors the built-in entries boot data adds: only -- Grafana -- has an id and a uid; the
// others get their name as uid, as the boot data cache does for entries without one.
function toBuiltInSettings(meta: DataSourcePluginMeta): DataSourceInstanceSettings {
  const isGrafana = meta.id === 'grafana';
  // Boot data built-ins carry no `access`, which the type requires; match boot data, not the type.
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const settings = {
    uid: isGrafana ? GRAFANA_BUILT_IN_UID : meta.name,
    name: meta.name,
    type: 'datasource',
    meta,
    jsonData: {},
    readOnly: false,
    isDefault: false,
  } as DataSourceInstanceSettings;
  if (isGrafana) {
    settings.id = GRAFANA_BUILT_IN_ID;
  }
  return settings;
}

export interface MappedSettings {
  settings: DataSourceInstanceSettings;
  isDirectAccess: boolean;
}

/**
 * Map a per-uid resource to instance settings, matching what boot data sends:
 * the proxy URL instead of the upstream one, no credentials, and the same per-type tweaks.
 */
export function toInstanceSettings(
  resource: DataSourceResource,
  item: DataSourceInstanceListItem,
  connection: DataSourceConnection
): MappedSettings {
  const { spec, metadata } = resource;
  const uid = metadata.name;
  const access = spec.access === 'direct' ? 'direct' : 'proxy';
  const jsonData: DataSourceJsonData & Record<string, unknown> = structuredClone(spec.jsonData ?? {});

  const settings: DataSourceInstanceSettings = {
    uid,
    name: spec.title,
    type: item.type,
    apiVersion: item.apiVersion,
    meta: item.meta,
    isDefault: item.isDefault,
    access,
    readOnly: spec.readOnly ?? false,
    jsonData,
    url: access === 'proxy' ? `/api/datasources/proxy/uid/${uid}` : spec.url,
  };

  const id = Number(metadata.labels?.[DEPRECATED_INTERNAL_ID_LABEL]);
  if (id) {
    settings.id = id;
  }
  // The MT APIs never expose credentials, so a direct-access data source gets no basic auth header,
  // username or password here, unlike in boot data.
  if (access === 'direct' && spec.withCredentials) {
    settings.withCredentials = true;
  }

  applyPerTypeTweaks(settings, jsonData, spec, getConnectionPluginType(connection));

  return { settings, isDirectAccess: access === 'direct' };
}

// Mirrors the per-type tweaks in getFSDataSources (pkg/api/bootdata.go). Boot data matches on the
// stored type, before alias normalization, so this does too.
function applyPerTypeTweaks(
  settings: DataSourceInstanceSettings,
  jsonData: Record<string, unknown>,
  spec: DataSourceResource['spec'],
  storedType: string
): void {
  switch (storedType) {
    case 'mssql':
    case 'mysql':
    case 'grafana-postgresql-datasource':
      if (jsonData.database == null || jsonData.database === '') {
        jsonData.database = spec.database ?? '';
      }
      break;
    case 'influxdb':
    case 'elasticsearch':
      // Boot data omits an empty database.
      if (spec.database) {
        settings.database = spec.database;
      }
      break;
    case 'prometheus':
    case 'grafana-amazonprometheus-datasource':
    case 'grafana-azureprometheus-datasource':
      jsonData.directUrl = spec.url ?? '';
      break;
  }
}

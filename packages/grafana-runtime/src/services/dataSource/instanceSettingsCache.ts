import { type DataSourceInstanceListItem, type DataSourceInstanceSettings } from '@grafana/data';

export interface InstanceSettingsCache {
  initializeFromConfig(settings: Record<string, DataSourceInstanceSettings>, defaultName: string): void;
  setBootData(settings: Record<string, DataSourceInstanceSettings>, defaultName: string): void;
  activateBootData(): void;
  getDefaultName(): string;
  getSettingsByName(name: string): DataSourceInstanceSettings | undefined;
  getSettingsByUid(uid: string): DataSourceInstanceSettings | undefined;
  getSettingsById(id: string): DataSourceInstanceSettings | undefined;
  getSettingsList(): DataSourceInstanceSettings[];
  getBootSettingsByName(name: string): DataSourceInstanceSettings | undefined;
  getBootSettingsByUid(uid: string): DataSourceInstanceSettings | undefined;
  getBootSettingsById(id: string): DataSourceInstanceSettings | undefined;
  getBootSettingsList(): DataSourceInstanceSettings[];
  getRuntimeSettingsByUid(uid: string): DataSourceInstanceSettings | undefined;
  getListItemByName(name: string): DataSourceInstanceListItem | undefined;
  getListItemByUid(uid: string): DataSourceInstanceListItem | undefined;
  getList(): DataSourceInstanceListItem[];
  upsertSettings(settings: DataSourceInstanceSettings): DataSourceInstanceSettings;
  registerRuntimeSettings(settings: DataSourceInstanceSettings): void;
  commitList(items: DataSourceInstanceListItem[]): void;
  clearSettings(): void;
  reset(): void;
}

export function createInstanceSettingsCache(): InstanceSettingsCache {
  let byName: Record<string, DataSourceInstanceSettings> = {};
  let byUid: Record<string, DataSourceInstanceSettings> = {};
  let byId: Record<string, DataSourceInstanceSettings> = {};
  let runtimeByUid: Record<string, DataSourceInstanceSettings> = {};
  let bootByName: Record<string, DataSourceInstanceSettings> = {};
  let bootByUid: Record<string, DataSourceInstanceSettings> = {};
  let bootById: Record<string, DataSourceInstanceSettings> = {};
  let listByName: Record<string, DataSourceInstanceListItem> = {};
  let listByUid: Record<string, DataSourceInstanceListItem> = {};
  let defaultName = '';

  function toListItem(settings: DataSourceInstanceSettings): DataSourceInstanceListItem {
    return {
      uid: settings.uid || settings.name,
      type: settings.type,
      apiVersion: settings.apiVersion,
      name: settings.name,
      meta: settings.meta,
      isDefault: settings.isDefault ?? false,
    };
  }

  function normalizeSettings(settings: DataSourceInstanceSettings): DataSourceInstanceSettings {
    return settings.uid ? settings : { ...settings, uid: settings.name };
  }

  function upsertSettings(settings: DataSourceInstanceSettings): DataSourceInstanceSettings {
    const normalized = normalizeSettings(settings);
    byName[normalized.name] = normalized;
    byUid[normalized.uid] = normalized;
    if (normalized.id) {
      byId[String(normalized.id)] = normalized;
    }
    return normalized;
  }

  function replaceSettings(settings: Record<string, DataSourceInstanceSettings>): void {
    byName = {};
    byUid = {};
    byId = {};
    for (const input of Object.values(settings)) {
      upsertSettings(input);
    }
    for (const runtime of Object.values(runtimeByUid)) {
      byUid[runtime.uid] = runtime;
    }
  }

  function setBootData(settings: Record<string, DataSourceInstanceSettings>, name: string): void {
    defaultName = name;
    bootByName = {};
    bootByUid = {};
    bootById = {};
    for (const input of Object.values(structuredClone(settings))) {
      const normalized = normalizeSettings(input);
      bootByName[normalized.name] = normalized;
      bootByUid[normalized.uid] = normalized;
      if (normalized.id) {
        bootById[String(normalized.id)] = normalized;
      }
    }
  }

  function commitList(items: DataSourceInstanceListItem[]): void {
    listByName = {};
    listByUid = {};
    for (const item of items) {
      listByName[item.name] = item;
      listByUid[item.uid] = item;
    }
  }

  function activateBootData(): void {
    replaceSettings(structuredClone(bootByName));
    commitList(Object.values(bootByName).map(toListItem));
  }

  function clearSettings(): void {
    byName = {};
    byUid = {};
    byId = {};
    for (const runtime of Object.values(runtimeByUid)) {
      byUid[runtime.uid] = runtime;
    }
  }

  function reset(): void {
    byName = {};
    byUid = {};
    byId = {};
    runtimeByUid = {};
    bootByName = {};
    bootByUid = {};
    bootById = {};
    listByName = {};
    listByUid = {};
    defaultName = '';
  }

  return {
    initializeFromConfig(settings, name) {
      setBootData(settings, name);
      activateBootData();
    },
    setBootData,
    activateBootData,
    getDefaultName: () => defaultName,
    getSettingsByName: (name) => byName[name],
    getSettingsByUid: (uid) => byUid[uid],
    getSettingsById: (id) => byId[id],
    getSettingsList: () => Object.values(byName),
    getBootSettingsByName: (name) => bootByName[name],
    getBootSettingsByUid: (uid) => bootByUid[uid],
    getBootSettingsById: (id) => bootById[id],
    getBootSettingsList: () => Object.values(bootByName),
    getRuntimeSettingsByUid: (uid) => runtimeByUid[uid],
    getListItemByName: (name) => listByName[name],
    getListItemByUid: (uid) => listByUid[uid],
    getList: () => Object.values(listByName),
    upsertSettings,
    registerRuntimeSettings(settings) {
      if (runtimeByUid[settings.uid] || byUid[settings.uid] || bootByUid[settings.uid] || listByUid[settings.uid]) {
        throw new Error(`A data source with uid ${settings.uid} has already been registered`);
      }
      runtimeByUid[settings.uid] = settings;
      byUid[settings.uid] = settings;
    },
    commitList,
    clearSettings,
    reset,
  };
}

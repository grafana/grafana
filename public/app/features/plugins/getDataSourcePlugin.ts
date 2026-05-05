import { DataSourceApi, type DataSourceRef, type ScopedVars } from '@grafana/data';
import { getInstanceSettings } from '@grafana/runtime';
import { getRuntimeDataSourcePlugin, UserStorage } from '@grafana/runtime/internal';

import { pluginImporter } from './importer/pluginImporter';

const instances: Record<string, DataSourceApi> = {};

export async function getDataSourcePlugin(
  ref?: DataSourceRef | string | null,
  scopedVars?: ScopedVars
): Promise<DataSourceApi> {
  const settings = await getInstanceSettings(ref, scopedVars);
  if (!settings) {
    throw new Error(`Datasource ${describeRef(ref)} was not found`);
  }

  if (instances[settings.uid]) {
    return instances[settings.uid];
  }

  const runtime = getRuntimeDataSourcePlugin(settings.uid);
  if (runtime) {
    instances[settings.uid] = runtime;
    return runtime;
  }

  const dsPlugin = await pluginImporter.importDataSource(settings.meta);

  // Another caller may have populated the cache while we were awaiting.
  if (instances[settings.uid]) {
    return instances[settings.uid];
  }

  const instance = new dsPlugin.DataSourceClass(settings);
  instance.components = dsPlugin.components;

  if (!instance.userStorage) {
    // DataSourceApi does not instantiate userStorage; DataSourceWithBackend does.
    instance.userStorage = new UserStorage(settings.type);
  }

  // Legacy plugins that don't extend DataSourceApi need manual patching.
  if (!(instance instanceof DataSourceApi)) {
    const anyInstance: { [key: string]: unknown } = instance;
    anyInstance.name = settings.name;
    anyInstance.id = settings.id;
    anyInstance.type = settings.type;
    anyInstance.meta = settings.meta;
    anyInstance.uid = settings.uid;
    anyInstance.getRef = DataSourceApi.prototype.getRef;
  }

  instances[settings.uid] = instance;
  return instance;
}

function describeRef(ref: DataSourceRef | string | null | undefined): string {
  if (ref == null) {
    return 'default';
  }
  if (typeof ref === 'string') {
    return ref;
  }
  return ref.uid ?? ref.type ?? 'unknown';
}

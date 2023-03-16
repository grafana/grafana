import { DataSourcePlugin, DataSourcePluginMeta } from '@grafana/data';
import { GenericDataSourcePlugin } from 'app/features/datasources/types';

import { SandboxProxyDataSource, SandboxQuery, SandboxOptions } from './sandbox_datasource';

export class SandboxDataSourcePlugin extends DataSourcePlugin<SandboxProxyDataSource, SandboxQuery, SandboxOptions> {
  constructor(meta: DataSourcePluginMeta) {
    super(SandboxProxyDataSource);
    this.meta = meta;
  }
}

export async function getSandboxDataSourcePlugin(meta: DataSourcePluginMeta): Promise<GenericDataSourcePlugin> {
  return new SandboxDataSourcePlugin(meta) as unknown as GenericDataSourcePlugin;
}

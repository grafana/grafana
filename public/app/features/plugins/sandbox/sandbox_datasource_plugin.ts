import { DataSourceInstanceSettings, DataSourcePlugin, DataSourcePluginMeta } from '@grafana/data';
import { GenericDataSourcePlugin } from 'app/features/datasources/types';

import { SandboxOptions, SandboxProxyDataSource, SandboxQuery } from './sandbox_datasource';

export class SandboxDataSourcePlugin extends DataSourcePlugin<SandboxProxyDataSource, SandboxQuery, SandboxOptions> {
  constructor(meta: DataSourcePluginMeta) {
    super(
      class extends SandboxProxyDataSource {
        constructor(instanceSettings: DataSourceInstanceSettings<SandboxOptions>) {
          super(instanceSettings);
          // this.meta = meta;
        }
      }
    );
    this.meta = meta;
  }
}

export async function getSandboxDataSourcePlugin(meta: DataSourcePluginMeta): Promise<GenericDataSourcePlugin> {
  return new SandboxDataSourcePlugin(meta) as GenericDataSourcePlugin;
}

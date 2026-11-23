import { type OrphanedDataSource } from 'app/types/datasources';

export class DataSourcePluginNotInstalledError extends Error {
  constructor(readonly dataSource: OrphanedDataSource) {
    super(`The plugin "${dataSource.pluginType}" of data source "${dataSource.uid}" is not installed`);
    this.name = 'DataSourcePluginNotInstalledError';
  }
}

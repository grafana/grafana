import { type DataSourcePluginContextType, type PluginContextType } from './PluginContext';

export function isDataSourcePluginContext(context: PluginContextType): context is DataSourcePluginContextType {
  return 'meta' in context && 'dataSource' in context;
}

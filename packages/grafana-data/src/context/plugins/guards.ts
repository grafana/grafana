import { type DataSourcePluginContextType, type PluginContextType } from './PluginContext';

export function isDataSourcePluginContext(context: PluginContextType): context is DataSourcePluginContextType {
  return 'instanceSettings' in context && 'meta' in context;
}

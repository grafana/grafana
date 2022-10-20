import { BasicPluginContextType, type DataSourcePluginContextType, type PluginContextType } from './PluginContext';

export function isDataSourcePluginContext(context: PluginContextType): context is DataSourcePluginContextType {
  return 'instanceSettings' in context;
}

export function isBasicPluginContext(context: PluginContextType): context is BasicPluginContextType {
  return 'meta' in context;
}

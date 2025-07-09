import { KeyValue } from '../../types/data';

import { type DataSourcePluginContextType, type PluginContextType } from './PluginContext';

export function isDataSourcePluginContext<T extends KeyValue = KeyValue>(
  context: PluginContextType<T>
): context is DataSourcePluginContextType<T> {
  return 'instanceSettings' in context && 'meta' in context;
}

import { createContext } from 'react';

import { type KeyValue } from '../../types/data';
import { type DataSourceInstanceSettings } from '../../types/datasource';
import { type PluginMeta } from '../../types/plugin';

export interface PluginContextType<T extends KeyValue = KeyValue> {
  meta: PluginMeta<T>;
}

export interface DataSourcePluginContextType<T extends KeyValue = KeyValue> extends PluginContextType<T> {
  instanceSettings: DataSourceInstanceSettings;
}

export const PluginContext = createContext<PluginContextType | undefined>(undefined);

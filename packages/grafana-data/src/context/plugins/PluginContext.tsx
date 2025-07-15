import { createContext } from 'react';

import { KeyValue } from '../../types/data';
import { DataSourceInstanceSettings } from '../../types/datasource';
import { PluginMeta } from '../../types/plugin';

export interface PluginContextType<T extends KeyValue = KeyValue> {
  meta: PluginMeta<T>;
}

export interface DataSourcePluginContextType<T extends KeyValue = KeyValue> extends PluginContextType<T> {
  instanceSettings: DataSourceInstanceSettings;
}

export const PluginContext = createContext<PluginContextType | undefined>(undefined);

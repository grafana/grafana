import { createContext } from 'react';

import { DataSourceInstanceSettings } from '../../types/datasource';
import { PluginMeta } from '../../types/plugin';

export type PluginContextType = BasePluginContextType | DataSourcePluginContextType;

export interface BasePluginContextType {
  meta: PluginMeta;
}

export interface DataSourcePluginContextType {
  instanceSettings: DataSourceInstanceSettings;
}

export const Context = createContext<PluginContextType | undefined>(undefined);

import { createContext } from 'react';

import { DataSourceInstanceSettings } from '../../types/datasource';
import { PluginMeta } from '../../types/plugin';

export interface PluginContextType {
  meta: PluginMeta;
}

export interface DataSourcePluginContextType extends PluginContextType {
  settings: DataSourceInstanceSettings;
}

export const Context = createContext<PluginContextType | DataSourcePluginContextType | undefined>(undefined);

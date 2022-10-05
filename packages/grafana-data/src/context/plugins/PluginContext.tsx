import { createContext } from 'react';

import { DataSourceApi } from '../../types/datasource';
import { PluginMeta } from '../../types/plugin';

export interface PluginContextType {
  meta: PluginMeta;
}

export interface DataSourcePluginContextType extends PluginContextType {
  dataSource: DataSourceApi;
}

export const Context = createContext<PluginContextType | DataSourcePluginContextType | undefined>(undefined);

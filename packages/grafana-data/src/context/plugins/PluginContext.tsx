import { createContext } from 'react';

import { DataSourceInstanceSettings } from '../../types/datasource';
import { PluginMeta } from '../../types/plugin';

export interface PluginContextType {
  meta: PluginMeta;
}

export interface DataSourcePluginContextType extends PluginContextType {
  instanceSettings: DataSourceInstanceSettings;
}

export const Context = createContext<PluginContextType | undefined>(undefined);

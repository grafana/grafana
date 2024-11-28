import { createContext } from 'react';

import { DataSourceInstanceSettings } from '../../types/datasource';
import { PluginMeta, UserStorage } from '../../types/plugin';

export interface PluginContextType {
  meta: PluginMeta;
  userStorage: UserStorage;
}

export interface DataSourcePluginContextType extends PluginContextType {
  instanceSettings: DataSourceInstanceSettings;
}

export const Context = createContext<PluginContextType | undefined>(undefined);

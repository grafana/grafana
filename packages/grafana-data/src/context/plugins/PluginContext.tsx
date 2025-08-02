import { createContext } from 'react';

import { KeyValue } from '../../types/data';
import { DataSourceInstanceSettings } from '../../types/datasource';
import { PluginMeta } from '../../types/plugin';

export interface PluginContextType<T extends KeyValue = KeyValue> {
  // In certain cases it's possible that plugins are nested into each other.
  // Example: an app plugin using scenes which is rendering panel plugins for visualisations.
  // In those cases the `parent` property would hold the plugin meta of the original plugin.
  parent: PluginContextType | null;
  meta: PluginMeta<T>;
}

export interface DataSourcePluginContextType<T extends KeyValue = KeyValue> extends PluginContextType<T> {
  instanceSettings: DataSourceInstanceSettings;
}

export const PluginContext = createContext<PluginContextType | undefined>(undefined);

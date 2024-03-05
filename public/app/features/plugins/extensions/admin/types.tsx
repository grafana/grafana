import { PluginExtensionRegistryItem } from '../types';

export type ExtensionPointConfig = {
  id: string;
  extensions: PluginExtensionRegistryItem[];
};

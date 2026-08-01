import { type PluginExtensionAddedLinkConfig } from '@grafana/data';
import { getExploreExtensionConfigs } from 'app/features/explore/extensions/getExploreExtensionConfigs';
import { getNotebookExtensionConfigs } from 'app/features/notebook/extensions/getNotebookExtensionConfigs';

export function getCoreExtensionConfigurations(): PluginExtensionAddedLinkConfig[] {
  return [...getExploreExtensionConfigs(), ...getNotebookExtensionConfigs()];
}

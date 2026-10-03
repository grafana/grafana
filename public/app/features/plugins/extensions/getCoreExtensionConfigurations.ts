import { type PluginExtensionAddedLinkConfig } from '@grafana/data';
import { getExploreExtensionConfigs } from 'app/features/explore/extensions/getExploreExtensionConfigs';
import { getNotebookCaptureSidebarExtension } from 'app/features/notebook/sidebar/getNotebookCaptureSidebarExtension';

export function getCoreExtensionConfigurations(): PluginExtensionAddedLinkConfig[] {
  return [...getExploreExtensionConfigs(), getNotebookCaptureSidebarExtension()];
}

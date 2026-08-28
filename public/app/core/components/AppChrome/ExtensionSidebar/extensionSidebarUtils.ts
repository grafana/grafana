// Deliberately free of React and of ExtensionSidebarProvider: non-component modules need the
// sidebar's persisted state, and importing the provider to get it drags the whole React module
// into their graph.

export const EXTENSION_SIDEBAR_DOCKED_LOCAL_STORAGE_KEY = 'grafana.navigation.extensionSidebarDocked';

export function getComponentIdFromComponentMeta(pluginId: string, componentTitle: string) {
  return JSON.stringify({ pluginId, componentTitle });
}

export function getComponentMetaFromComponentId(
  componentId: string
): { pluginId: string; componentTitle: string } | undefined {
  try {
    const parsed = JSON.parse(componentId);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'pluginId' in parsed &&
      'componentTitle' in parsed &&
      typeof parsed.pluginId === 'string' &&
      typeof parsed.componentTitle === 'string'
    ) {
      return parsed;
    }
    return undefined;
  } catch (error) {
    return undefined;
  }
}

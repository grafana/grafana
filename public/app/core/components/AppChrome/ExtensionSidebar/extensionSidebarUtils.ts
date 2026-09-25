// Deliberately free of React and of ExtensionSidebarProvider: non-component modules need the
// sidebar's persisted state, and importing the provider to get it drags the whole React module
// into their graph.

export const EXTENSION_SIDEBAR_DOCKED_LOCAL_STORAGE_KEY = 'grafana.navigation.extensionSidebarDocked';
export const EXTENSION_SIDEBAR_URL_PARAM = 'extensionSidebar';

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

export function getComponentUrlValue(componentId: string): string | undefined {
  const meta = getComponentMetaFromComponentId(componentId);
  return meta ? `${meta.pluginId}/${meta.componentTitle}` : undefined;
}

export function getComponentIdFromUrlValue(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const separatorIndex = value.indexOf('/');
  if (separatorIndex <= 0 || separatorIndex === value.length - 1) {
    return undefined;
  }

  return getComponentIdFromComponentMeta(value.slice(0, separatorIndex), value.slice(separatorIndex + 1));
}

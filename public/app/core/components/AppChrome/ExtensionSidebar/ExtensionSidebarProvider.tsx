import { createContext, ReactNode, useContext, useState } from 'react';

import { store, type ExtensionInfo } from '@grafana/data';
import { getExtensionPointPluginMeta } from 'app/features/plugins/extensions/utils';

export const EXTENSION_SIDEBAR_EXTENSION_POINT_ID = 'grafana/extension-sidebar/v0-alpha';
const EXTENSION_SIDEBAR_DOCKED_LOCAL_STORAGE_KEY = 'grafana.navigation.extensionSidebarDocked';
const ENABLED_EXTENSION_SIDEBAR_PLUGINS = ['grafana-investigations-app'];

type ExtensionSidebarContextType = {
  dockedComponentId: string | undefined;
  setDockedComponentId: (componentId: string | undefined) => void;
  availableComponents: Map<
    string,
    {
      readonly exposedComponents: ExtensionInfo[];
      readonly addedLinks: ExtensionInfo[];
    }
  >;
};

export const ExtensionSidebarContext = createContext<ExtensionSidebarContextType>({
  dockedComponentId: undefined,
  setDockedComponentId: () => {},
  availableComponents: new Map(),
});

export function useExtensionSidebarContext() {
  return useContext(ExtensionSidebarContext);
}

interface ExtensionSidebarContextProps {
  children: ReactNode;
}

export const ExtensionSidebarContextProvider = ({ children }: ExtensionSidebarContextProps) => {
  const storedDockedPluginId = store.get(EXTENSION_SIDEBAR_DOCKED_LOCAL_STORAGE_KEY);
  // get all components for this extension point, but only for the permitted plugins
  const availableComponents = new Map(
    Array.from(getExtensionPointPluginMeta(EXTENSION_SIDEBAR_EXTENSION_POINT_ID).entries()).filter(([pluginId]) =>
      ENABLED_EXTENSION_SIDEBAR_PLUGINS.includes(pluginId)
    )
  );

  const [dockedComponentId, setDockedComponentId] = useState<string | undefined>(undefined);

  return (
    <ExtensionSidebarContext.Provider value={{ dockedComponentId, setDockedComponentId, availableComponents }}>
      {children}
    </ExtensionSidebarContext.Provider>
  );
};

export function getIdFromComponentMeta(pluginId: string, component: ExtensionInfo) {
  return JSON.stringify({ pluginId, componentTitle: component.title });
}

export function getComponentMetaFromId(componentId: string): { pluginId: string; componentTitle: string } | undefined {
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

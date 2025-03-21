import { createContext, ReactNode, useContext, useEffect, useState } from 'react';

import { ComponentTypeWithExtensionMeta, store } from '@grafana/data';
import { usePluginComponents } from '@grafana/runtime';

export const EXTENSION_SIDEBAR_EXTENSION_POINT_ID = 'grafana/extension-sidebar/v0-alpha';
const EXTENSION_SIDEBAR_DOCKED_LOCAL_STORAGE_KEY = 'grafana.navigation.extensionSidebarDocked';
const ENABLED_EXTENSION_SIDEBAR_PLUGINS = ['grafana-investigations-app'];

type ExtensionSidebarContextType = {
  dockedPluginId: string | undefined;
  setDockedPluginId: (pluginId: string | undefined) => void;
  components: Map<string, ComponentTypeWithExtensionMeta<{}>>;
};

export const ExtensionSidebarContext = createContext<ExtensionSidebarContextType>({
  dockedPluginId: undefined,
  setDockedPluginId: () => {},
  components: new Map<string, ComponentTypeWithExtensionMeta<{}>>(),
});

export function useExtensionSidebarContext() {
  return useContext(ExtensionSidebarContext);
}

interface ExtensionSidebarContextProps {
  children: ReactNode;
}

export const ExtensionSidebarContextProvider = ({ children }: ExtensionSidebarContextProps) => {
  const { components } = usePluginComponents({
    extensionPointId: EXTENSION_SIDEBAR_EXTENSION_POINT_ID,
  });

  const componentsMap = new Map(
    components
      .filter((c) => ENABLED_EXTENSION_SIDEBAR_PLUGINS.includes(c.meta.pluginId))
      .map((c) => [c.meta.pluginId, c])
  );

  const storedDockedPluginId = store.get(EXTENSION_SIDEBAR_DOCKED_LOCAL_STORAGE_KEY);
  const [dockedPluginId, setDockedPluginId] = useState<string | undefined>(
    componentsMap.has(storedDockedPluginId) ? storedDockedPluginId : undefined
  );

  useEffect(() => {
    if (dockedPluginId) {
      store.set(EXTENSION_SIDEBAR_DOCKED_LOCAL_STORAGE_KEY, dockedPluginId);
    }
  }, [dockedPluginId]);

  return (
    <ExtensionSidebarContext.Provider value={{ dockedPluginId, setDockedPluginId, components: componentsMap }}>
      {children}
    </ExtensionSidebarContext.Provider>
  );
};

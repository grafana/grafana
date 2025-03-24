import { createContext, ReactNode, useContext, useEffect, useState, useMemo } from 'react';

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
  const storedDockedPluginId = store.get(EXTENSION_SIDEBAR_DOCKED_LOCAL_STORAGE_KEY);
  const { components, isLoading } = usePluginComponents({
    extensionPointId: EXTENSION_SIDEBAR_EXTENSION_POINT_ID,
  });
  const [dockedPluginId, setDockedPluginId] = useState<string | undefined>(undefined);

  const componentsMap = useMemo(
    () =>
      new Map(
        components
          .filter((c) => ENABLED_EXTENSION_SIDEBAR_PLUGINS.includes(c.meta.pluginId))
          .map((c) => [c.meta.pluginId, c])
      ),
    [components]
  );

  // update the initial docked plugin id when the components are loaded
  useEffect(() => {
    if (!isLoading) {
      const storedDockedPluginId = store.get(EXTENSION_SIDEBAR_DOCKED_LOCAL_STORAGE_KEY);
      setDockedPluginId(componentsMap.has(storedDockedPluginId) ? storedDockedPluginId : undefined);
    }
  }, [componentsMap, isLoading, storedDockedPluginId]);

  useEffect(() => {
    if (dockedPluginId && !isLoading) {
      store.set(EXTENSION_SIDEBAR_DOCKED_LOCAL_STORAGE_KEY, dockedPluginId);
    } else if (!dockedPluginId && !isLoading) {
      store.delete(EXTENSION_SIDEBAR_DOCKED_LOCAL_STORAGE_KEY);
    }
  }, [dockedPluginId, isLoading]);

  return (
    <ExtensionSidebarContext.Provider value={{ dockedPluginId, setDockedPluginId, components: componentsMap }}>
      {children}
    </ExtensionSidebarContext.Provider>
  );
};

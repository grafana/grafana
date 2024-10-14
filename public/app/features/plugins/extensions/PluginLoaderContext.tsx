import { PropsWithChildren, createContext, useCallback, useContext, useState } from 'react';

import { preloadPlugins } from '../pluginPreloader';

import { PluginExtensionRegistries } from './registry/types';
import { getAppPluginConfigs } from './utils';

export type PluginLoaderContextType = {
  loadAppPlugins: (pluginIds: string[]) => void;
  isLoading: boolean;
};

export const PluginLoaderContext = createContext<PluginLoaderContextType>({
  loadAppPlugins: async () => {},
  isLoading: false,
});

export function usePluginLoaderContext(): PluginLoaderContextType {
  const context = useContext(PluginLoaderContext);
  if (!context) {
    throw new Error('No `PluginLoaderContext` found.');
  }
  return context;
}

export const PluginLoaderContextProvider = ({
  registries,
  children,
}: PropsWithChildren<{ registries: PluginExtensionRegistries }>) => {
  const [isLoading, setIsLoading] = useState(false);
  const loadAppPlugins = useCallback(
    (pluginIds: string[] = []) => {
      const appConfigs = getAppPluginConfigs(pluginIds);

      if (!appConfigs.length) {
        return;
      }

      // setIsLoading(true);
      preloadPlugins(appConfigs, registries).then(() => {
        // setIsLoading(false);
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return <PluginLoaderContext.Provider value={{ loadAppPlugins, isLoading }}>{children}</PluginLoaderContext.Provider>;
};

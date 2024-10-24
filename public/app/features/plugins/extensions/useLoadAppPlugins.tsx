import { usePluginLoaderContext } from './PluginLoaderContext';

export function useLoadAppPlugins(pluginIds: string[] = []): { isLoading: boolean } {
  const { loadAppPlugins, isLoading } = usePluginLoaderContext();

  loadAppPlugins(pluginIds);

  return { isLoading };
}

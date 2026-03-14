import { PluginExtensionPoints } from '@grafana/data';
import { usePluginComponents } from '@grafana/runtime';

// Asserts has a dedicated static AdCard (AssertsCard.tsx), so we exclude its
// extension to avoid showing a duplicate card on the alerting home page.
const EXCLUDED_PLUGIN_IDS = ['grafana-asserts-app'];

export function useAlertingHomePageExtensions() {
  const { components, isLoading } = usePluginComponents({
    extensionPointId: PluginExtensionPoints.AlertingHomePage,
    limitPerPlugin: 1,
  });

  return {
    components: components.filter((c) => !EXCLUDED_PLUGIN_IDS.includes(c.meta.pluginId)),
    isLoading,
  };
}

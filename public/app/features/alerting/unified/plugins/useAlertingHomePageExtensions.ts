import { PluginExtensionPoints } from '@grafana/data/types';
import { usePluginComponents } from '@grafana/runtime';

export function useAlertingHomePageExtensions() {
  return usePluginComponents({
    extensionPointId: PluginExtensionPoints.AlertingHomePage,
    limitPerPlugin: 1,
  });
}

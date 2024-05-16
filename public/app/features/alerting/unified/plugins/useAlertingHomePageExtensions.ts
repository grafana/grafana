import { PluginExtensionPoints } from '@grafana/data';
import { usePluginComponentExtensions } from '@grafana/runtime';

export function useAlertingHomePageExtensions() {
  return usePluginComponentExtensions({
    extensionPointId: PluginExtensionPoints.AlertingHomePage,
    limitPerPlugin: 1,
  });
}

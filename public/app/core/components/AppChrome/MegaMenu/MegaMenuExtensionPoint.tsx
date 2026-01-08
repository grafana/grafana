import { PluginExtensionPoints } from '@grafana/data';
import { renderLimitedComponents } from '@grafana/runtime';
import { usePluginComponents } from 'app/features/plugins/extensions/usePluginComponents';

/**
 * Extension point for plugins to add components to the mega menu.
 * Currently restricted to grafana-setupguide-app plugin.
 */
export function MegaMenuExtensionPoint() {
  const { components } = usePluginComponents({
    extensionPointId: PluginExtensionPoints.MegaMenuAction,
  });

  // Return null if no components are registered
  if (components.length === 0) {
    return null;
  }

  return renderLimitedComponents({
    props: {},
    components: components,
    limit: 1,
    pluginId: 'grafana-setupguide-app',
  });
}

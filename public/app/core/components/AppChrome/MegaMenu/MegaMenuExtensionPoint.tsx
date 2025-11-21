import { useContext } from 'react';

import { renderLimitedComponents } from '@grafana/runtime';
import { AddedComponentsRegistryContext } from 'app/features/plugins/extensions/ExtensionRegistriesContext';
import { usePluginComponents } from 'app/features/plugins/extensions/usePluginComponents';

/**
 * Extension point for plugins to add components to the mega menu.
 * Currently restricted to grafana-setupguide-app plugin.
 */
export function MegaMenuExtensionPoint() {
  // Check if plugin extension context is available (not available in tests)
  const context = useContext(AddedComponentsRegistryContext);

  if (!context) {
    // Silently return null in test environments or when plugin context is not available
    return null;
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { components } = usePluginComponents({
    extensionPointId: 'grafana/megamenu/action',
  });

  return (
    <>
      {renderLimitedComponents({
        props: {},
        components: components,
        limit: 1,
        pluginId: 'grafana-setupguide-app',
      })}
    </>
  );
}

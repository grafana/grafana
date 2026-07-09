import { type PluginExtensionAddedComponentConfig } from '@grafana/data';

import { GRAFANA_CORE_PLUGIN_ID } from './constants';
import { getPluginExtensionRegistries } from './registry/setup';

/**
 * Registers a component extension on behalf of core Grafana. Use this for code that is compiled
 * into the core bundle (e.g. Grafana Enterprise frontend) rather than delivered as an app plugin.
 *
 * The component is rendered by the targeted extension points like any plugin-provided component,
 * but without a plugin context. Targets should be core extension points declared in
 * `PluginExtensionPoints`.
 *
 * Safe to call during boot: the registration is applied once the registries are initialized, and
 * extension points that are already rendered pick it up reactively.
 */
export async function registerCoreAddedComponent<Props = {}>(
  config: PluginExtensionAddedComponentConfig<Props>
): Promise<void> {
  const { addedComponentsRegistry } = await getPluginExtensionRegistries();

  addedComponentsRegistry.register({
    pluginId: GRAFANA_CORE_PLUGIN_ID,
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    configs: [config as PluginExtensionAddedComponentConfig],
  });
}

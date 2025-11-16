import { ReplaySubject } from 'rxjs';

import {
  PluginExtensionCommandPaletteDynamicConfig,
  CommandPaletteDynamicResult,
  PluginExtensionCommandPaletteContext,
} from '@grafana/data';

import { isGrafanaDevMode } from '../utils';

import { PluginExtensionConfigs, Registry, RegistryType } from './Registry';

const logPrefix = '[CommandPaletteDynamic]';

export interface CommandPaletteDynamicRegistryItem {
  pluginId: string;
  config: PluginExtensionCommandPaletteDynamicConfig;
}

export interface CommandPaletteDynamicSearchResult {
  items: CommandPaletteDynamicResult[];
  config: CommandPaletteDynamicRegistryItem;
}

export class CommandPaletteDynamicRegistry extends Registry<
  CommandPaletteDynamicRegistryItem[],
  PluginExtensionCommandPaletteDynamicConfig
> {
  constructor(
    options: {
      registrySubject?: ReplaySubject<RegistryType<CommandPaletteDynamicRegistryItem[]>>;
      initialState?: RegistryType<CommandPaletteDynamicRegistryItem[]>;
    } = {}
  ) {
    super(options);
  }

  mapToRegistry(
    registry: RegistryType<CommandPaletteDynamicRegistryItem[]>,
    item: PluginExtensionConfigs<PluginExtensionCommandPaletteDynamicConfig>
  ): RegistryType<CommandPaletteDynamicRegistryItem[]> {
    const { pluginId, configs } = item;

    for (const config of configs) {
      const { title, searchProvider, category } = config;

      if (!title || typeof title !== 'string') {
        this.logger.error(`${logPrefix} Plugin ${pluginId}: title is required and must be a string`);
        continue;
      }

      if (!searchProvider || typeof searchProvider !== 'function') {
        this.logger.error(`${logPrefix} Plugin ${pluginId}: searchProvider must be a function`);
        continue;
      }

      const providerId = `${pluginId}/${title}`;

      if (!(providerId in registry)) {
        registry[providerId] = [];
      }

      registry[providerId].push({
        pluginId,
        config: {
          ...config,
          category: category ?? pluginId,
          minQueryLength: config.minQueryLength ?? 2,
          debounceMs: config.debounceMs ?? 300,
        },
      });

      if (isGrafanaDevMode()) {
        console.log(`${logPrefix} Registered provider: ${providerId}`);
      }
    }

    return registry;
  }

  /**
   * Execute a search across all registered providers
   */
  async search(context: PluginExtensionCommandPaletteContext): Promise<Map<string, CommandPaletteDynamicSearchResult>> {
    const registry = await this.getState();
    const results = new Map<string, CommandPaletteDynamicSearchResult>();
    const searchQuery = context.searchQuery ?? '';

    const searchPromises = Object.entries(registry).map(async ([providerId, registryItems]) => {
      if (!Array.isArray(registryItems) || registryItems.length === 0) {
        return;
      }

      const item = registryItems[0]; // Take first config per provider
      const { config } = item;

      // Check minimum query length
      if (searchQuery.length < (config.minQueryLength ?? 2)) {
        return;
      }

      // Check if provider is active
      if (config.isActive && !config.isActive(context)) {
        return;
      }

      try {
        const items = await config.searchProvider(context);

        // Validate results
        if (!Array.isArray(items)) {
          this.logger.warning(`${logPrefix} Provider ${providerId} did not return an array`);
          return;
        }

        // Validate and filter items
        const validItems = items
          .filter((item) => {
            if (!item.id || typeof item.id !== 'string') {
              this.logger.warning(`${logPrefix} Provider ${providerId}: result missing id`);
              return false;
            }
            if (!item.title || typeof item.title !== 'string') {
              this.logger.warning(`${logPrefix} Provider ${providerId}: result missing title`);
              return false;
            }
            return true;
          })
          .slice(0, 5); // Limit to 5 items maximum

        if (validItems.length > 0) {
          results.set(providerId, { items: validItems, config: item });
        }
      } catch (error) {
        // Don't log AbortErrors as they are expected
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }
        this.logger.error(`${logPrefix} Search failed for ${providerId}`, { error: String(error) });
      }
    });

    await Promise.all(searchPromises);
    return results;
  }
}

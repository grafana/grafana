import { ReplaySubject, Subject, firstValueFrom, map, scan, startWith } from 'rxjs';

import {
  PluginExtensionCommandPaletteDynamicConfig,
  CommandPaletteDynamicResult,
  PluginExtensionCommandPaletteContext,
} from '@grafana/data';

import { CommandPaletteDynamicFacet } from './facetTypes';

import { deepFreeze } from '../plugins/extensions/utils';

const logPrefix = '[CommandPaletteDynamic]';

export interface CommandPaletteDynamicRegistryItem {
  pluginId: string;
  config: PluginExtensionCommandPaletteDynamicConfig;
}

export interface CommandPaletteDynamicSearchResult {
  items: CommandPaletteDynamicResult[];
  config: CommandPaletteDynamicRegistryItem;
}

export interface DynamicProviderCategory {
  label: string;
  hasFacets: boolean;
  icon?: string;
}

type PluginExtensionConfigs = {
  pluginId: string;
  configs: PluginExtensionCommandPaletteDynamicConfig[];
};

type RegistryType = Record<string, CommandPaletteDynamicRegistryItem[]>;

const MSG_CANNOT_REGISTER_READ_ONLY = 'Cannot register to a read-only registry';

export class CommandPaletteDynamicRegistry {
  private isReadOnly: boolean;
  private resultSubject: Subject<PluginExtensionConfigs>;
  private registrySubject: ReplaySubject<RegistryType>;

  constructor(
    options: {
      registrySubject?: ReplaySubject<RegistryType>;
      initialState?: RegistryType;
    } = {}
  ) {
    this.resultSubject = new Subject<PluginExtensionConfigs>();
    this.isReadOnly = false;

    // If the registry subject is provided, it's a read-only instance
    if (options.registrySubject) {
      this.registrySubject = options.registrySubject;
      this.isReadOnly = true;
      return;
    }

    this.registrySubject = new ReplaySubject<RegistryType>(1);
    this.resultSubject
      .pipe(
        scan(this.mapToRegistry.bind(this), options.initialState ?? {}),
        startWith(options.initialState ?? {}),
        map((registry) => deepFreeze(registry))
      )
      .subscribe(this.registrySubject);
  }

  private mapToRegistry(registry: RegistryType, item: PluginExtensionConfigs): RegistryType {
    const { pluginId, configs } = item;

    for (let index = 0; index < configs.length; index++) {
      const config = configs[index];
      const { searchProvider, category } = config;

      if (!searchProvider || typeof searchProvider !== 'function') {
        console.error(`${logPrefix} Plugin ${pluginId}: searchProvider must be a function`);
        continue;
      }

      // Use index to differentiate multiple providers from same plugin.
      // Note: Provider IDs are index-based, so changing the order of configs
      // in addCommandPaletteDynamicProvider calls could affect result tracking.
      // Plugins should maintain consistent ordering of their providers.
      const providerId = `${pluginId}/${index}`;

      if (!(providerId in registry)) {
        registry[providerId] = [];
      }

      registry[providerId].push({
        pluginId,
        config: {
          ...config,
          category: category,
          minQueryLength: config.minQueryLength ?? 2,
        },
      });

      if (process.env.NODE_ENV === 'development') {
        console.log(`${logPrefix} Registered provider: ${providerId}`);
      }
    }

    return registry;
  }

  register(result: PluginExtensionConfigs): void {
    if (this.isReadOnly) {
      throw new Error(MSG_CANNOT_REGISTER_READ_ONLY);
    }

    this.resultSubject.next(result);
  }

  asObservable() {
    return this.registrySubject.asObservable();
  }

  getState(): Promise<RegistryType> {
    return firstValueFrom(this.asObservable());
  }

  /**
   * Returns unique category labels from all registered providers.
   */
  async getCategories(): Promise<DynamicProviderCategory[]> {
    const registry = await this.getState();
    const seen = new Map<string, DynamicProviderCategory>();

    for (const [, registryItems] of Object.entries(registry)) {
      if (!Array.isArray(registryItems) || registryItems.length === 0) {
        continue;
      }
      const config = registryItems[0].config;
      const label = config.category;
      if (label && !seen.has(label)) {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const categoryIcon = (config as Record<string, unknown>).categoryIcon as string | undefined;
        seen.set(label, {
          label,
          hasFacets: Boolean(config.facets && config.facets.length > 0),
          icon: categoryIcon,
        });
      }
    }

    return [...seen.values()];
  }

  /**
   * Returns facet definitions, optionally filtered by category label.
   */
  async getFacets(categoryFilter?: string): Promise<Map<string, CommandPaletteDynamicFacet[]>> {
    const registry = await this.getState();
    const facetsMap = new Map<string, CommandPaletteDynamicFacet[]>();

    for (const [providerId, registryItems] of Object.entries(registry)) {
      if (!Array.isArray(registryItems) || registryItems.length === 0) {
        continue;
      }
      const config = registryItems[0].config;
      if (categoryFilter && config.category !== categoryFilter) {
        continue;
      }
      const facets = config.facets;
      if (facets && facets.length > 0) {
        facetsMap.set(providerId, facets);
      }
    }

    return facetsMap;
  }

  /**
   * Execute a search across registered providers, optionally filtered by category.
   */
  async search(
    context: PluginExtensionCommandPaletteContext & {
      activeFacets?: Record<string, string>;
      selectedCategory?: string;
    }
  ): Promise<Map<string, CommandPaletteDynamicSearchResult>> {
    const registry = await this.getState();
    const results = new Map<string, CommandPaletteDynamicSearchResult>();
    const searchQuery = context.searchQuery ?? '';
    const signal = context.signal ?? new AbortController().signal;

    const dynamicContext = {
      searchQuery,
      signal,
      activeFacets: context.activeFacets,
    };

    const searchPromises = Object.entries(registry)
      .filter(([, registryItems]) => {
        if (!context.selectedCategory) {
          return true;
        }
        if (!Array.isArray(registryItems) || registryItems.length === 0) {
          return false;
        }
        return registryItems[0].config.category === context.selectedCategory;
      })
      .map(async ([providerId, registryItems]) => {
        if (!Array.isArray(registryItems) || registryItems.length === 0) {
          return;
        }

        const item = registryItems[0];
        const { config } = item;

        if (!context.selectedCategory && searchQuery.length < (config.minQueryLength ?? 2)) {
          return;
        }

        try {
          const items = await config.searchProvider(dynamicContext);

          if (!Array.isArray(items)) {
            console.warn(`${logPrefix} Provider ${providerId} did not return an array`);
            return;
          }

          const maxItems = context.selectedCategory ? 8 : 5;
          const validItems = items
            .filter((item) => {
              if (!item.id || typeof item.id !== 'string') {
                console.warn(`${logPrefix} Provider ${providerId}: result missing id`);
                return false;
              }
              if (!item.title || typeof item.title !== 'string') {
                console.warn(`${logPrefix} Provider ${providerId}: result missing title`);
                return false;
              }
              return true;
            })
            .slice(0, maxItems);

          if (validItems.length > 0) {
            results.set(providerId, { items: validItems, config: item });
          }
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') {
            return;
          }
          console.error(`${logPrefix} Search failed for ${providerId}`, { error: String(error) });
        }
      });

    await Promise.all(searchPromises);
    return results;
  }

  /**
   * Returns a read-only version of the registry.
   */
  readOnly() {
    return new CommandPaletteDynamicRegistry({
      registrySubject: this.registrySubject,
    });
  }
}

/**
 * Global instance of the Command Palette Dynamic Registry
 * This registry is used to manage dynamic command palette providers from plugins
 */
export const commandPaletteDynamicRegistry = new CommandPaletteDynamicRegistry();

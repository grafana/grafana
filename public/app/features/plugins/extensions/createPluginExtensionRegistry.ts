import { Observable, Subject, map, reduce } from 'rxjs';

import type { PluginPreloadResult } from '../pluginPreloader';

import type { PluginExtensionRegistryItem, PluginExtensionRegistry } from './types';
import { deepFreeze, logWarning } from './utils';
import { isPluginExtensionConfigValid } from './validators';

let subject = new Subject<PluginPreloadResult>();

export function appendPluginExtensionToRegistry(result: PluginPreloadResult): void {
  subject.next(result);
}

export function createPluginExtensionRegistry(
  pluginPreloadResults: PluginPreloadResult[]
): Observable<PluginExtensionRegistry> {
  return subject.asObservable().pipe(
    reduce<PluginPreloadResult, PluginExtensionRegistry>((registry, result, index) => {
      const { pluginId, extensionConfigs, error } = result;

      if (error) {
        logWarning(`"${pluginId}" plugin failed to load, skip registering its extensions.`);
        return registry;
      }

      for (const extensionConfig of extensionConfigs) {
        const { extensionPointId } = extensionConfig;

        if (!extensionConfig || !isPluginExtensionConfigValid(pluginId, extensionConfig)) {
          return registry;
        }

        let registryItem: PluginExtensionRegistryItem = {
          config: extensionConfig,

          // Additional meta information about the extension
          pluginId,
        };

        if (!Array.isArray(registry[extensionPointId])) {
          registry[extensionPointId] = [registryItem];
        } else {
          registry[extensionPointId].push(registryItem);
        }
      }

      return registry;
    }, {}),
    map((unfrozen) => deepFreeze(unfrozen))
  );
}

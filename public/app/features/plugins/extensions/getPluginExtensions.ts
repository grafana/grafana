import { isString } from 'lodash';
import { catchError, combineLatest, lastValueFrom, from, map, merge, mergeMap, Observable, of, scan } from 'rxjs';

import {
  PluginExtensionTypes,
  type PluginExtension,
  type PluginExtensionLink,
  type PluginExtensionComponent,
} from '@grafana/data';
import { type GetObservablePluginLinks, type GetObservablePluginComponents } from '@grafana/runtime/internal';

import { ExtensionsLog, log } from './logs/log';
import { AddedComponentRegistryItem } from './registry/AddedComponentsRegistry';
import { AddedLinkRegistryItem } from './registry/AddedLinksRegistry';
import { pluginExtensionRegistries } from './registry/setup';
import type { PluginExtensionRegistries } from './registry/types';
import { GetExtensionsOptions, GetPluginExtensions } from './types';
import {
  getReadOnlyProxy,
  generateExtensionId,
  wrapWithPluginContext,
  getLinkExtensionOnClick,
  getLinkExtensionOverrides,
  getLinkExtensionPathWithTracking,
} from './utils';

/**
 * Returns an observable that emits plugin extensions whenever the core extensions registries change.
 * The observable will emit the initial state of the extensions and then emit again whenever
 * either the added components registry or the added links registry changes.
 *
 * @param options - The options for getting plugin extensions
 * @returns An Observable that emits the plugin extensions for the given extension point any time the registries change
 */

export const getObservablePluginExtensions = (
  options: Omit<GetExtensionsOptions, 'addedComponentsRegistry' | 'addedLinksRegistry'>
): Observable<{ extensions: PluginExtension[] }> => {
  const { extensionPointId } = options;
  const { addedComponentsRegistry, addedLinksRegistry } = pluginExtensionRegistries;

  return getPluginExtensions({
    ...options,
    addedComponentsRegistry: addedComponentsRegistry.asObservableSlice((state) => state[extensionPointId]),
    addedLinksRegistry: addedLinksRegistry.asObservableSlice((state) => state[extensionPointId]),
  });
};

export const getObservablePluginLinks: GetObservablePluginLinks = (options) => {
  return getObservablePluginExtensions(options).pipe(
    map((value) => value.extensions.filter((extension) => extension.type === PluginExtensionTypes.link))
  );
};

export const getObservablePluginComponents: GetObservablePluginComponents = (options) => {
  return getObservablePluginExtensions(options).pipe(
    map((value) => value.extensions.filter((extension) => extension.type === PluginExtensionTypes.component))
  );
};

export function createPluginExtensionsGetter(registries: PluginExtensionRegistries): GetPluginExtensions {
  return async (options) => {
    const { extensionPointId } = options;
    const observable = getPluginExtensions({
      ...options,
      addedComponentsRegistry: registries.addedComponentsRegistry.asObservableSlice((state) => state[extensionPointId]),
      addedLinksRegistry: registries.addedLinksRegistry.asObservableSlice((state) => state[extensionPointId]),
    });

    // Convert Observable to Promise by taking the last emitted value
    // This will wait for all configure() functions to resolve and return the final state
    return lastValueFrom(observable, { defaultValue: { extensions: [] } });
  };
}

type LinkOverrideResult = {
  id: string;
  extension: PluginExtensionLink | null; // null means hide the extension
};

function getAddedComponentLog(registryItem: AddedComponentRegistryItem) {
  return log.child({
    title: registryItem.title,
    description: registryItem.description ?? '',
    pluginId: registryItem.pluginId,
  });
}

function createPluginExtensionComponent({
  extensionPointId,
  registryItem,
  log
}: {
  extensionPointId: string, 
  registryItem: AddedComponentRegistryItem,
  log?: ExtensionsLog
}): PluginExtensionComponent {
  return {
    id: generateExtensionId(registryItem.pluginId, extensionPointId, registryItem.title),
    type: PluginExtensionTypes.component,
    pluginId: registryItem.pluginId,
    title: registryItem.title,
    description: registryItem.description ?? '',
    component: wrapWithPluginContext({
      pluginId: registryItem.pluginId,
      extensionTitle: registryItem.title,
      Component: registryItem.component,
      log: log ?? getAddedComponentLog(registryItem),
    }),
  };
}

// Returns an observable that emits plugin extensions for the given extension point
// Emits incrementally as configure() functions resolve for link extensions
export function getPluginExtensions({
  context,
  extensionPointId,
  limitPerPlugin,
  addedLinksRegistry,
  addedComponentsRegistry,
}: {
  context?: object | Record<string | symbol, unknown>;
  extensionPointId: string;
  limitPerPlugin?: number;
  addedLinksRegistry: Observable<AddedLinkRegistryItem[] | undefined>;
  addedComponentsRegistry: Observable<AddedComponentRegistryItem[] | undefined>;
}): Observable<{ extensions: PluginExtension[] }> {
  const frozenContext = context ? getReadOnlyProxy(context) : {};

  return combineLatest([addedComponentsRegistry, addedLinksRegistry]).pipe(
    mergeMap(([addedComponents, addedLinks]) => {
      // Process components immediately (they don't have async configure)
      const componentExtensions: PluginExtensionComponent[] = [];
      const extensionsByPlugin: Record<string, number> = {};

      // ADDED COMPONENTS --------------------------------------------------- 
      for (const registryItem of addedComponents ?? []) {
        // Only limit if the `limitPerPlugin` is set
        if (limitPerPlugin && extensionsByPlugin[registryItem.pluginId] >= limitPerPlugin) {
          continue;
        }

        if (extensionsByPlugin[registryItem.pluginId] === undefined) {
          extensionsByPlugin[registryItem.pluginId] = 0;
        }

        componentExtensions.push(createPluginExtensionComponent({
          registryItem,
          extensionPointId,
        }));

        extensionsByPlugin[registryItem.pluginId] += 1;
      }

      // LINKS  -------------------------------------------------------------
      const links = addedLinks ?? [];
      const linksWithConfigure = links.filter((addedLink) => addedLink.configure);

      if (linksWithConfigure.length === 0) {
        // No links with configure, return components immediately
        return of({ extensions: componentExtensions });
      }

      // Process links incrementally - emit as each configure() resolves
      const linkObservables = linksWithConfigure.map((addedLink) => {
        const { pluginId } = addedLink;
        const linkLog = log.child({
          pluginId,
          extensionPointId,
          path: addedLink.path ?? '',
          title: addedLink.title,
          description: addedLink.description ?? '',
          onClick: typeof addedLink.onClick,
        });

        const linkId = generateExtensionId(pluginId, extensionPointId, addedLink.title);

        return from(getLinkExtensionOverrides(addedLink, linkLog, frozenContext)).pipe(
          (map((overrides): LinkOverrideResult => {
            // configure() returned an `undefined` -> hide the extension
            if (overrides === undefined) {
              return {
                id: linkId,
                extension: null,
              };
            }

            const path = overrides?.path || addedLink.path;
            const extension: PluginExtensionLink = {
              id: linkId,
              type: PluginExtensionTypes.link,
              pluginId: pluginId,
              onClick: getLinkExtensionOnClick(pluginId, extensionPointId, addedLink, linkLog, frozenContext),

              // Configurable properties
              icon: overrides?.icon || addedLink.icon,
              title: overrides?.title || addedLink.title,
              description: overrides?.description || addedLink.description || '',
              path: isString(path) ? getLinkExtensionPathWithTracking(pluginId, path, extensionPointId) : undefined,
              category: overrides?.category || addedLink.category,
            };

            return {
              id: linkId,
              extension,
            };
          }),
            catchError((error) => {
              if (error instanceof Error) {
                log.error(error.message, {
                  stack: error.stack ?? '',
                  message: error.message,
                });
              }
              // On error, hide the extension
              return of({
                id: linkId,
                extension: null,
              });
            }));
        );
      });

      // Also include links without configure() function
      const linksWithoutConfigure = links.filter((addedLink) => !addedLink.configure);
      const staticLinkExtensions: PluginExtensionLink[] = [];

      for (const addedLink of linksWithoutConfigure) {
        const { pluginId } = addedLink;

        // Only limit if the `limitPerPlugin` is set
        if (limitPerPlugin && extensionsByPlugin[pluginId] >= limitPerPlugin) {
          continue;
        }

        if (extensionsByPlugin[pluginId] === undefined) {
          extensionsByPlugin[pluginId] = 0;
        }

        const linkLog = log.child({
          pluginId,
          extensionPointId,
          path: addedLink.path ?? '',
          title: addedLink.title,
          description: addedLink.description ?? '',
          onClick: typeof addedLink.onClick,
        });

        const extension: PluginExtensionLink = {
          id: generateExtensionId(pluginId, extensionPointId, addedLink.title),
          type: PluginExtensionTypes.link,
          pluginId: pluginId,
          onClick: getLinkExtensionOnClick(pluginId, extensionPointId, addedLink, linkLog, frozenContext),
          icon: addedLink.icon,
          title: addedLink.title,
          description: addedLink.description || '',
          path: isString(addedLink.path)
            ? getLinkExtensionPathWithTracking(pluginId, addedLink.path, extensionPointId)
            : undefined,
          category: addedLink.category,
        };

        staticLinkExtensions.push(extension);
        extensionsByPlugin[pluginId] += 1;
      }

      // Merge all link observables and accumulate results as they resolve
      return merge(...linkObservables).pipe(
        scan((acc: Map<string, LinkOverrideResult>, result: LinkOverrideResult) => {
          // Update with new result
          const newAcc = new Map(acc);
          newAcc.set(result.id, result);
          return newAcc;
        }, new Map<string, LinkOverrideResult>()),
        map((linkResultsMap) => {
          // Build extensions array: components + static links + resolved links (excluding null/hidden ones)
          const linkExtensions: PluginExtensionLink[] = [...staticLinkExtensions];
          const linkExtensionsByPlugin: Record<string, number> = { ...extensionsByPlugin };

          for (const result of linkResultsMap.values()) {
            if (result.extension) {
              const { pluginId } = result.extension;

              // Only limit if the `limitPerPlugin` is set
              if (limitPerPlugin && linkExtensionsByPlugin[pluginId] >= limitPerPlugin) {
                continue;
              }

              if (linkExtensionsByPlugin[pluginId] === undefined) {
                linkExtensionsByPlugin[pluginId] = 0;
              }

              linkExtensions.push(result.extension);
              linkExtensionsByPlugin[pluginId] += 1;
            }
          }

          // Combine components and links
          return {
            extensions: [...componentExtensions, ...linkExtensions],
          };
        })
      );
    })
  );
}

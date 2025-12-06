import { isString } from 'lodash';
import {
  combineLatest,
  lastValueFrom,
  from,
  map,
  merge,
  mergeMap,
  Observable,
  of,
  scan,
  startWith,
  identity,
  filter,
} from 'rxjs';

import {
  PluginExtensionTypes,
  type PluginExtension,
  type PluginExtensionLink,
  type PluginExtensionComponent,
} from '@grafana/data';
import { type GetObservablePluginLinks, type GetObservablePluginComponents } from '@grafana/runtime/internal';

import { ExtensionsLog, log } from './logs/log';
import { AddedComponentRegistryItem, AddedComponentsRegistry } from './registry/AddedComponentsRegistry';
import { AddedLinksRegistry } from './registry/AddedLinksRegistry';
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
  const { addedComponentsRegistry, addedLinksRegistry } = pluginExtensionRegistries;

  return getPluginExtensions({
    ...options,
    addedComponentsRegistry,
    addedLinksRegistry,
  });
};

export const getObservablePluginLinks: GetObservablePluginLinks = (options) => {
  return getObservablePluginExtensions(options).pipe(
    map((value) => value.extensions.filter((extension) => extension.type === PluginExtensionTypes.link)),
    filter((extensions) => extensions.length > 0)
  );
};

export const getObservablePluginComponents: GetObservablePluginComponents = (options) => {
  return getObservablePluginExtensions(options).pipe(
    map((value) => value.extensions.filter((extension) => extension.type === PluginExtensionTypes.component)),
    filter((extensions) => extensions.length > 0)
  );
};

export function createPluginExtensionsGetter(registries: PluginExtensionRegistries): GetPluginExtensions {
  return async (options) => {
    const observable = getPluginExtensions({
      ...options,
      addedComponentsRegistry: registries.addedComponentsRegistry,
      addedLinksRegistry: registries.addedLinksRegistry,
    });

    // Convert Observable to Promise by taking the last emitted value
    // This will wait for all configure() functions to resolve and return the final state
    return lastValueFrom(observable, { defaultValue: { extensions: [] } });
  };
}

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
  log,
}: {
  extensionPointId: string;
  registryItem: AddedComponentRegistryItem;
  log?: ExtensionsLog;
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
  addedLinksRegistry: AddedLinksRegistry;
  addedComponentsRegistry: AddedComponentsRegistry;
}): Observable<{ extensions: PluginExtension[] }> {
  const frozenContext = context ? getReadOnlyProxy(context) : {};

  return combineLatest([
    addedComponentsRegistry.asObservableSlice((state) => state[extensionPointId]),
    addedLinksRegistry.asObservableSlice((state) => state[extensionPointId]),
  ]).pipe(
    mergeMap(([addedComponents, addedLinks]) => {
      const staticLinkExtensionsByPlugin: Record<string, number> = {};
      const componentExtensionsByPlugin: Record<string, number> = {};

      // ADDED COMPONENTS ---------------------------------------------------
      // Process components immediately (they don't have async configure)
      const componentExtensions: PluginExtensionComponent[] = [];
      for (const registryItem of addedComponents ?? []) {
        // Only limit if the `limitPerPlugin` is set
        if (limitPerPlugin && componentExtensionsByPlugin[registryItem.pluginId] >= limitPerPlugin) {
          continue;
        }

        if (componentExtensionsByPlugin[registryItem.pluginId] === undefined) {
          componentExtensionsByPlugin[registryItem.pluginId] = 0;
        }

        componentExtensions.push(
          createPluginExtensionComponent({
            registryItem,
            extensionPointId,
          })
        );

        componentExtensionsByPlugin[registryItem.pluginId] += 1;
      }

      // LINKS  -------------------------------------------------------------
      const links = addedLinks ?? [];
      const linksWithConfigure = links.filter((addedLink) => addedLink.configure);
      const linksWithoutConfigure = links.filter((addedLink) => !addedLink.configure);

      // Process static links (without configure function) immediately
      const staticLinkExtensions: PluginExtensionLink[] = [];
      for (const addedLink of linksWithoutConfigure) {
        const { pluginId } = addedLink;

        // Only limit if the `limitPerPlugin` is set
        if (limitPerPlugin && staticLinkExtensionsByPlugin[pluginId] >= limitPerPlugin) {
          continue;
        }

        if (staticLinkExtensionsByPlugin[pluginId] === undefined) {
          staticLinkExtensionsByPlugin[pluginId] = 0;
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
        staticLinkExtensionsByPlugin[pluginId] += 1;
      }

      // No links with configure, return components + static links immediately
      if (linksWithConfigure.length === 0) {
        return of({ extensions: [...componentExtensions, ...staticLinkExtensions] });
      }

      // Process links incrementally - emit as each configure() resolves
      const linkObservables = linksWithConfigure.map((addedLink) => {
        const { pluginId } = addedLink;
        const linkId = generateExtensionId(pluginId, extensionPointId, addedLink.title);
        const linkLog = log.child({
          pluginId,
          extensionPointId,
          path: addedLink.path ?? '',
          title: addedLink.title,
          description: addedLink.description ?? '',
          onClick: typeof addedLink.onClick,
        });

        return from(getLinkExtensionOverrides(addedLink, linkLog, frozenContext)).pipe(
          map((overrides): PluginExtensionLink | null => {
            // configure() returned an `undefined` -> hide the extension
            if (overrides === undefined) {
              return null;
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

            return extension;
          })
        );
      });

      // Merge all link observables and accumulate results as they resolve
      // We use startWith to emit immediately with static links + components,
      // then emit again as each configure() function resolves
      return merge(...linkObservables).pipe(
        scan((acc: Set<PluginExtensionLink>, result: PluginExtensionLink | null) => {
          if (!result) {
            return acc;
          }

          return new Set([...acc.values(), result]);
        }, new Set()),
        map((linkResults) => {
          // Build extensions array: components + static links + resolved links (excluding null/hidden ones)
          const linkExtensions: PluginExtensionLink[] = [];
          const linkExtensionsByPlugin: Record<string, number> = {};

          for (const result of [...staticLinkExtensions, ...linkResults.values()]) {
            if (result) {
              const { pluginId } = result;

              // Only limit if the `limitPerPlugin` is set
              if (limitPerPlugin && linkExtensionsByPlugin[pluginId] >= limitPerPlugin) {
                continue;
              }

              if (linkExtensionsByPlugin[pluginId] === undefined) {
                linkExtensionsByPlugin[pluginId] = 0;
              }

              linkExtensions.push(result);
              linkExtensionsByPlugin[pluginId] += 1;
            }
          }

          // Combine components and links
          return {
            extensions: [...componentExtensions, ...linkExtensions],
          };
        }),
        [...componentExtensions, ...staticLinkExtensions].length > 0
          ? startWith({ extensions: [...componentExtensions, ...staticLinkExtensions] })
          : identity
      );
    })
  );
}

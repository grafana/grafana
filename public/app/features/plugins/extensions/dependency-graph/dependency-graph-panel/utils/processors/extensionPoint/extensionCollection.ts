/**
 * Extension Collection for Extension Point Processing
 *
 * Handles collection and processing of extensions (links, components, functions).
 */

import { AppPluginConfig } from '@grafana/data';

import { Extension } from '../../../types';
import {
  hasAddedComponentsProperty,
  hasAddedFunctionsProperty,
  hasAddedLinksProperty,
  isExtensionObject,
} from '../../helpers/typeGuards';

import { FilterSetup } from './filterSetup';

/**
 * Collects all extensions from plugin data
 */
export function collectExtensions(
  pluginData: Record<string, AppPluginConfig>,
  filters: FilterSetup
): Map<string, Extension> {
  const extensions: Map<string, Extension> = new Map();

  Object.entries(pluginData).forEach(([pluginId, pluginInfo]) => {
    const pluginExtensions = pluginInfo.extensions;
    if (!pluginExtensions) {
      return;
    }

    // Skip this plugin if content provider filtering is enabled and this plugin is not selected
    if (filters.shouldFilterContentProviders && !filters.selectedContentProviders.includes(pluginId)) {
      return;
    }

    // Process added links
    if (hasAddedLinksProperty(pluginExtensions) && pluginExtensions.addedLinks.length > 0) {
      const addedLinks = pluginExtensions.addedLinks;
      addedLinks.forEach((link) => {
        if (isExtensionObject(link) && link.targets) {
          const targets = Array.isArray(link.targets) ? link.targets : [link.targets];
          targets.forEach((target) => {
            if (target && target.trim() !== '') {
              const extensionId = `${pluginId}-link-${target}-${link.title || 'Link Extension'}`.replace(
                /[^a-zA-Z0-9-]/g,
                '-'
              );

              // Filter by selected extension points if specified
              if (filters.shouldFilterExtensionPoints && !filters.selectedExtensionPoints.includes(target)) {
                return;
              }

              extensions.set(extensionId, {
                id: extensionId,
                providingPlugin: pluginId,
                targetExtensionPoint: target,
                type: 'link',
                title: link.title || 'Link Extension',
                description: link.description || '',
              });
            }
          });
        }
      });
    }

    // Process added components
    if (hasAddedComponentsProperty(pluginExtensions) && pluginExtensions.addedComponents.length > 0) {
      const addedComponents = pluginExtensions.addedComponents;
      addedComponents.forEach((comp) => {
        if (isExtensionObject(comp) && comp.targets) {
          const targets = Array.isArray(comp.targets) ? comp.targets : [comp.targets];
          targets.forEach((target) => {
            if (target && target.trim() !== '') {
              const extensionId = `${pluginId}-component-${target}-${comp.title || 'Component Extension'}`.replace(
                /[^a-zA-Z0-9-]/g,
                '-'
              );

              // Filter by selected extension points if specified
              if (filters.shouldFilterExtensionPoints && !filters.selectedExtensionPoints.includes(target)) {
                return;
              }

              extensions.set(extensionId, {
                id: extensionId,
                providingPlugin: pluginId,
                targetExtensionPoint: target,
                type: 'component',
                title: comp.title || 'Component Extension',
                description: comp.description || '',
              });
            }
          });
        }
      });
    }

    // Process added functions
    if (hasAddedFunctionsProperty(pluginExtensions) && pluginExtensions.addedFunctions.length > 0) {
      const addedFunctions = pluginExtensions.addedFunctions;
      addedFunctions.forEach((func) => {
        if (isExtensionObject(func) && func.targets) {
          const targets = Array.isArray(func.targets) ? func.targets : [func.targets];
          targets.forEach((target) => {
            if (target && target.trim() !== '') {
              const extensionId = `${pluginId}-function-${target}-${func.title || 'Function Extension'}`.replace(
                /[^a-zA-Z0-9-]/g,
                '-'
              );

              // Filter by selected extension points if specified
              if (filters.shouldFilterExtensionPoints && !filters.selectedExtensionPoints.includes(target)) {
                return;
              }

              extensions.set(extensionId, {
                id: extensionId,
                providingPlugin: pluginId,
                targetExtensionPoint: target,
                type: 'function',
                title: func.title || 'Function Extension',
                description: func.description || '',
              });
            }
          });
        }
      });
    }
  });

  return extensions;
}

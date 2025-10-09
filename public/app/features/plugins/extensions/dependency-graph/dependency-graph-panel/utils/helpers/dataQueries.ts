import { ExposedComponent } from '../../types';

// Note: We avoid importing from processors to prevent circular dependencies
import { getPluginData } from './dataAccess';
import {
  hasAddedComponentsProperty,
  hasAddedFunctionsProperty,
  hasAddedLinksProperty,
  isExtensionObject,
} from './typeGuards';

// Memoization for expensive helper functions
const availableProvidersCache = new Map<string, string[]>();
const availableConsumersCache = new Map<string, string[]>();
const activeConsumersCache = new Map<string, string[]>();
const availableExtensionPointsCache = new Map<string, string[]>();
const availableExtensionsCache = new Map<string, string[]>();

/**
 * Gets all available content provider plugin IDs for the specified visualization mode.
 *
 * @param mode - Visualization mode: 'exposedComponents' (plugins that expose components), 'extensionpoint' (plugins that provide extensions), 'addedlinks' (plugins that add link extensions), 'addedcomponents' (plugins that add component extensions), or 'addedfunctions' (plugins that add function extensions)
 * @returns Sorted array of plugin IDs that act as content providers
 */
export const getAvailableContentProviders = (
  mode: 'exposedComponents' | 'extensionpoint' | 'addedlinks' | 'addedcomponents' | 'addedfunctions' = 'addedlinks'
): string[] => {
  if (availableProvidersCache.has(mode)) {
    return availableProvidersCache.get(mode)!;
  }

  const contentProviders = new Set<string>();
  const pluginData = getPluginData();

  Object.entries(pluginData).forEach(([pluginId, pluginInfo]) => {
    const extensions = pluginInfo.extensions;

    if (mode === 'exposedComponents') {
      // In expose mode, content providers are plugins that expose components
      const exposesComponents =
        extensions.exposedComponents &&
        extensions.exposedComponents.length > 0 &&
        extensions.exposedComponents.some((comp) => comp && comp.id && comp.id.trim() !== '');

      if (exposesComponents) {
        contentProviders.add(pluginId);
      }
    } else if (mode === 'extensionpoint') {
      // In extension point mode, content providers are plugins that provide extensions
      const providesExtensions =
        (extensions.addedLinks && extensions.addedLinks.length > 0) ||
        (extensions.addedComponents && extensions.addedComponents.length > 0) ||
        (extensions.addedFunctions && extensions.addedFunctions.length > 0);

      if (providesExtensions) {
        contentProviders.add(pluginId);
      }
    } else if (mode === 'addedlinks') {
      // In added links mode, content providers are plugins that add link extensions
      const addsLinks = extensions.addedLinks && extensions.addedLinks.length > 0;

      if (addsLinks) {
        contentProviders.add(pluginId);
      }
    } else if (mode === 'addedcomponents') {
      // In added components mode, content providers are plugins that add component extensions
      const addsComponents = extensions.addedComponents && extensions.addedComponents.length > 0;

      if (addsComponents) {
        contentProviders.add(pluginId);
      }
    } else if (mode === 'addedfunctions') {
      // In added functions mode, content providers are plugins that add function extensions
      const addsFunctions = extensions.addedFunctions && extensions.addedFunctions.length > 0;

      if (addsFunctions) {
        contentProviders.add(pluginId);
      }
    }
  });

  const result = Array.from(contentProviders).sort();
  availableProvidersCache.set(mode, result);
  return result;
};

/**
 * Gets all available content consumer plugin IDs for the specified visualization mode.
 *
 * @param mode - Visualization mode: 'exposedComponents' (plugins that consume exposed components), 'extensionpoint' (plugins that define extension points), 'addedlinks' (plugins that define extension points targeted by link extensions), 'addedcomponents' (plugins that define extension points targeted by component extensions), or 'addedfunctions' (plugins that define extension points targeted by function extensions)
 * @returns Sorted array of plugin IDs that act as content consumers
 */
export const getAvailableContentConsumers = (
  mode: 'exposedComponents' | 'extensionpoint' | 'addedlinks' | 'addedcomponents' | 'addedfunctions' = 'addedlinks'
): string[] => {
  if (availableConsumersCache.has(mode)) {
    return availableConsumersCache.get(mode)!;
  }

  const contentConsumers = new Set<string>();
  const pluginData = getPluginData();

  Object.entries(pluginData).forEach(([pluginId, pluginInfo]) => {
    if (mode === 'exposedComponents') {
      // In expose mode, content consumers are plugins that depend on exposed components
      const pluginDependencies = pluginInfo.dependencies;
      const dependsOnExposedComponents =
        pluginDependencies.extensions?.exposedComponents && pluginDependencies.extensions.exposedComponents.length > 0;

      if (dependsOnExposedComponents) {
        contentConsumers.add(pluginId);
      }
    } else if (mode === 'extensionpoint') {
      // In extension point mode, content consumers are plugins that define extension points
      const extensions = pluginInfo.extensions;
      if (extensions.extensionPoints && extensions.extensionPoints.length > 0) {
        contentConsumers.add(pluginId);
      }
    } else if (mode === 'addedlinks') {
      // In added links mode, content consumers are plugins that define extension points targeted by link extensions
      const extensions = pluginInfo.extensions;
      if (extensions.extensionPoints && extensions.extensionPoints.length > 0) {
        // Check if any of the extension points are targeted by link extensions
        const hasLinkTargets = extensions.extensionPoints.some((ep) => {
          // Check if this extension point is targeted by any link extensions
          return Object.values(pluginData).some((otherPlugin) => {
            const otherExtensions = otherPlugin.extensions;
            return (
              otherExtensions.addedLinks &&
              otherExtensions.addedLinks.some((link) => link.targets && link.targets.includes(ep.id))
            );
          });
        });

        if (hasLinkTargets) {
          contentConsumers.add(pluginId);
        }
      }
    } else if (mode === 'addedcomponents') {
      // In added components mode, content consumers are plugins that define extension points targeted by component extensions
      const extensions = pluginInfo.extensions;
      if (extensions.extensionPoints && extensions.extensionPoints.length > 0) {
        // Check if any of the extension points are targeted by component extensions
        const hasComponentTargets = extensions.extensionPoints.some((ep) => {
          // Check if this extension point is targeted by any component extensions
          return Object.values(pluginData).some((otherPlugin) => {
            const otherExtensions = otherPlugin.extensions;
            return (
              otherExtensions.addedComponents &&
              otherExtensions.addedComponents.some(
                (component) => component.targets && component.targets.includes(ep.id)
              )
            );
          });
        });

        if (hasComponentTargets) {
          contentConsumers.add(pluginId);
        }
      }
    } else if (mode === 'addedfunctions') {
      // In added functions mode, content consumers are plugins that define extension points targeted by function extensions
      const extensions = pluginInfo.extensions;
      if (extensions.extensionPoints && extensions.extensionPoints.length > 0) {
        // Check if any of the extension points are targeted by function extensions
        const hasFunctionTargets = extensions.extensionPoints.some((ep) => {
          // Check if this extension point is targeted by any function extensions
          return Object.values(pluginData).some((otherPlugin) => {
            const otherExtensions = otherPlugin.extensions;
            return (
              otherExtensions.addedFunctions &&
              otherExtensions.addedFunctions.some((function_) => function_.targets && function_.targets.includes(ep.id))
            );
          });
        });

        if (hasFunctionTargets) {
          contentConsumers.add(pluginId);
        }
      }
    }
  });

  // For both modes, also check if grafana-core is referenced anywhere and add it
  // This handles cases where grafana-core might be referenced but not defined as a plugin
  if (mode === 'extensionpoint' || mode === 'addedlinks' || mode === 'addedcomponents' || mode === 'addedfunctions') {
    // Check if grafana-core is referenced as a target in any dependencies or extension points
    Object.values(pluginData).forEach((pluginInfo) => {
      // Check extension point targets
      if (pluginInfo.extensions.extensionPoints) {
        pluginInfo.extensions.extensionPoints.forEach((ep) => {
          if (ep.id && ep.id.includes('grafana-core')) {
            contentConsumers.add('grafana-core');
          }
        });
      }

      // Check if any extensions target grafana-core
      const allExtensions = [
        ...(pluginInfo.extensions.addedLinks || []),
        ...(pluginInfo.extensions.addedComponents || []),
        ...(pluginInfo.extensions.addedFunctions || []),
      ];

      allExtensions.forEach((ext) => {
        if (ext.targets) {
          (Array.isArray(ext.targets) ? ext.targets : [ext.targets]).forEach((target: string) => {
            if (target.includes('grafana-core')) {
              contentConsumers.add('grafana-core');
            }
          });
        }
      });
    });
  }

  // In exposed components mode, also include all consumers found in the processed graph data
  if (mode === 'exposedComponents') {
    // To get all actual consumers (including those like grafana-core that might not be in pluginData),
    // we need to temporarily process the graph and collect all consumer IDs
    const tempExposedComponents = new Map<string, ExposedComponent>();

    // First pass: collect all exposed components (same as in processPluginDataToExposeGraph)
    Object.entries(pluginData).forEach(([pluginId, pluginInfo]) => {
      const extensions = pluginInfo.extensions;
      if (extensions.exposedComponents && extensions.exposedComponents.length > 0) {
        extensions.exposedComponents.forEach((exposedComponent) => {
          if (exposedComponent && exposedComponent.id && exposedComponent.id.trim() !== '') {
            tempExposedComponents.set(exposedComponent.id, {
              id: exposedComponent.id,
              title: exposedComponent.title || exposedComponent.id,
              description: exposedComponent.description || '',
              providingPlugin: pluginId,
              consumers: [], // Will be populated in second pass
            });
          }
        });
      }
    });

    // Second pass: collect dependencies and consumers
    Object.entries(pluginData).forEach(([pluginId, pluginInfo]) => {
      const pluginDependencies = pluginInfo.dependencies;
      if (
        pluginDependencies.extensions?.exposedComponents &&
        pluginDependencies.extensions.exposedComponents.length > 0
      ) {
        pluginDependencies.extensions.exposedComponents.forEach((exposedComponentId: string) => {
          if (exposedComponentId.trim() !== '') {
            const exposedComponent = tempExposedComponents.get(exposedComponentId);
            if (exposedComponent) {
              // Add this plugin as a consumer - this is where we capture all consumers
              contentConsumers.add(pluginId);
            }
          }
        });
      }
    });
  }

  // Add grafana-core for extension point mode since it's not declared in data.json
  if (mode === 'extensionpoint') {
    contentConsumers.add('grafana-core');
  }

  const result = Array.from(contentConsumers).sort();
  availableConsumersCache.set(mode, result);
  return result;
};

/**
 * Gets content consumer plugin IDs that are actually active (have providers).
 *
 * Unlike getAvailableContentConsumers, this only returns consumers that actually
 * have content providers connecting to them, making it useful for default selections.
 *
 * @param mode - Visualization mode: 'exposedComponents', 'extensionpoint', 'addedlinks', 'addedcomponents', or 'addedfunctions'
 * @returns Sorted array of plugin IDs that are active content consumers
 */
export const getActiveContentConsumers = (
  mode: 'exposedComponents' | 'extensionpoint' | 'addedlinks' | 'addedcomponents' | 'addedfunctions' = 'addedlinks'
): string[] => {
  if (activeConsumersCache.has(mode)) {
    return activeConsumersCache.get(mode)!;
  }

  const activeConsumers = new Set<string>();
  const pluginData = getPluginData();

  if (mode === 'exposedComponents') {
    // In exposed components mode, active consumers are plugins that actually depend on components that exist
    Object.entries(pluginData).forEach(([pluginId, pluginInfo]) => {
      const pluginDependencies = pluginInfo.dependencies;

      if (
        pluginDependencies.extensions?.exposedComponents &&
        pluginDependencies.extensions.exposedComponents.length > 0
      ) {
        // Check if any of the components they depend on are actually exposed by other plugins
        const hasValidDependencies = pluginDependencies.extensions.exposedComponents.some(
          (exposedComponentId: string) => {
            return Object.values(pluginData).some((otherPlugin) => {
              return otherPlugin.extensions.exposedComponents?.some((comp) => comp.id === exposedComponentId);
            });
          }
        );

        if (hasValidDependencies) {
          activeConsumers.add(pluginId);
        }
      }
    });

    // Also include all consumers that are actually referenced in the processed graph
    // This captures consumers like "grafana-core" that might be referenced but not defined as plugins
    // We implement this logic inline to avoid circular dependencies
    try {
      const tempExposedComponents = new Map<string, ExposedComponent>();

      // First pass: collect all exposed components
      Object.entries(pluginData).forEach(([pluginId, pluginInfo]) => {
        const extensions = pluginInfo.extensions;
        if (extensions.exposedComponents && extensions.exposedComponents.length > 0) {
          extensions.exposedComponents.forEach((exposedComponent) => {
            if (exposedComponent && exposedComponent.id && exposedComponent.id.trim() !== '') {
              tempExposedComponents.set(exposedComponent.id, {
                id: exposedComponent.id,
                title: exposedComponent.title || exposedComponent.id,
                description: exposedComponent.description || '',
                providingPlugin: pluginId,
                consumers: [], // Will be populated in second pass
              });
            }
          });
        }
      });

      // Second pass: collect dependencies and consumers
      Object.entries(pluginData).forEach(([pluginId, pluginInfo]) => {
        const pluginDependencies = pluginInfo.dependencies;
        if (
          pluginDependencies.extensions?.exposedComponents &&
          pluginDependencies.extensions.exposedComponents.length > 0
        ) {
          pluginDependencies.extensions.exposedComponents.forEach((exposedComponentId: string) => {
            if (exposedComponentId.trim() !== '') {
              const exposedComponent = tempExposedComponents.get(exposedComponentId);
              if (exposedComponent) {
                // Add this plugin as a consumer - this is where we capture all consumers
                activeConsumers.add(pluginId);
              }
            }
          });
        }
      });
    } catch (error) {
      // If processing fails, continue without the additional consumers
      console.warn('Failed to process graph data for consumer detection:', error);
    }
  } else if (mode === 'addedlinks') {
    // In added links mode, active consumers are plugins with extension points that have link providers
    Object.entries(pluginData).forEach(([pluginId, pluginInfo]) => {
      const extensions = pluginInfo.extensions;

      // Check if any other plugin targets this plugin's extension points with link extensions
      if (extensions.extensionPoints && extensions.extensionPoints.length > 0) {
        const extensionPointIds = extensions.extensionPoints.map((ep) => ep.id);

        // Check if any other plugin targets these extension points with link extensions
        const hasLinkProviders = Object.values(pluginData).some((otherPlugin) => {
          const otherExtensions = otherPlugin.extensions;
          return (otherExtensions.addedLinks || []).some((item) =>
            (Array.isArray(item.targets) ? item.targets : [item.targets]).some((target: string) =>
              extensionPointIds.includes(target)
            )
          );
        });

        if (hasLinkProviders) {
          activeConsumers.add(pluginId);
        }
      }
    });
  } else if (mode === 'addedcomponents') {
    // In added components mode, active consumers are plugins with extension points that have component providers
    Object.entries(pluginData).forEach(([pluginId, pluginInfo]) => {
      const extensions = pluginInfo.extensions;

      // Check if any other plugin targets this plugin's extension points with component extensions
      if (extensions.extensionPoints && extensions.extensionPoints.length > 0) {
        const extensionPointIds = extensions.extensionPoints.map((ep) => ep.id);

        // Check if any other plugin targets these extension points with component extensions
        const hasComponentProviders = Object.values(pluginData).some((otherPlugin) => {
          const otherExtensions = otherPlugin.extensions;
          return (otherExtensions.addedComponents || []).some((item) =>
            (Array.isArray(item.targets) ? item.targets : [item.targets]).some((target: string) =>
              extensionPointIds.includes(target)
            )
          );
        });

        if (hasComponentProviders) {
          activeConsumers.add(pluginId);
        }
      }
    });
  } else if (mode === 'addedfunctions') {
    // In added functions mode, active consumers are plugins with extension points that have function providers
    Object.entries(pluginData).forEach(([pluginId, pluginInfo]) => {
      const extensions = pluginInfo.extensions;

      // Check if any other plugin targets this plugin's extension points with function extensions
      if (extensions.extensionPoints && extensions.extensionPoints.length > 0) {
        const extensionPointIds = extensions.extensionPoints.map((ep) => ep.id);

        // Check if any other plugin targets these extension points with function extensions
        const hasFunctionProviders = Object.values(pluginData).some((otherPlugin) => {
          const otherExtensions = otherPlugin.extensions;
          return (otherExtensions.addedFunctions || []).some((item) =>
            (Array.isArray(item.targets) ? item.targets : [item.targets]).some((target: string) =>
              extensionPointIds.includes(target)
            )
          );
        });

        if (hasFunctionProviders) {
          activeConsumers.add(pluginId);
        }
      }
    });
  } else {
    // In add mode, active consumers are plugins with extension points that have providers
    Object.entries(pluginData).forEach(([pluginId, pluginInfo]) => {
      const extensions = pluginInfo.extensions;

      // Check if any other plugin targets this plugin's extension points
      if (extensions.extensionPoints && extensions.extensionPoints.length > 0) {
        const extensionPointIds = extensions.extensionPoints.map((ep) => ep.id);

        // Check if any other plugin targets these extension points
        const hasProviders = Object.values(pluginData).some((otherPlugin) => {
          const otherExtensions = otherPlugin.extensions;
          return [
            ...(otherExtensions.addedLinks || []),
            ...(otherExtensions.addedComponents || []),
            ...(otherExtensions.addedFunctions || []),
          ].some((item) =>
            (Array.isArray(item.targets) ? item.targets : [item.targets]).some((target: string) =>
              extensionPointIds.includes(target)
            )
          );
        });

        if (hasProviders) {
          activeConsumers.add(pluginId);
        }
      }
    });
  }

  // FOR TESTING: Add grafana-core to both modes to verify mechanism works
  activeConsumers.add('grafana-core');

  const result = Array.from(activeConsumers).sort();
  activeConsumersCache.set(mode, result);
  return result;
};

/**
 * Gets all available extension point IDs for the extension point mode.
 *
 * @returns Sorted array of extension point IDs
 */
export const getAvailableExtensionPoints = (): string[] => {
  if (availableExtensionPointsCache.has('extensionpoint')) {
    return availableExtensionPointsCache.get('extensionpoint')!;
  }

  const extensionPoints = new Set<string>();
  const pluginData = getPluginData();

  Object.entries(pluginData).forEach(([pluginId, pluginInfo]) => {
    const extensions = pluginInfo.extensions;
    if (extensions.extensionPoints && extensions.extensionPoints.length > 0) {
      extensions.extensionPoints.forEach((ep) => {
        if (ep && ep.id && ep.id.trim() !== '') {
          extensionPoints.add(ep.id);
        }
      });
    }
  });

  // Add Grafana core extension points since they're not declared in data.json
  const grafanaCoreExtensionPoints = [
    'grafana/alerting/instance/action',
    'grafana/alerting/home',
    'grafana/alerting/alertingrule/action',
    'grafana/alerting/recordingrule/action',
    'grafana/alerting/alertingrule/queryeditor',
    'grafana/commandpalette/action',
    'grafana/dashboard/panel/menu',
    'grafana/datasources/config',
    'grafana/datasources/config/actions',
    'grafana/datasources/config/error-status',
    'grafana/datasources/config/status',
    'grafana/explore/toolbar/action',
    'grafana/user/profile/tab',
    'grafana/traceview/details',
    'grafana/traceview/header/actions',
    'grafana/query-editor-row/adaptivetelemetry/v1',
    'grafana/traceview/resource-attributes',
    'grafana/logsview/resource-attributes',
    'grafana/app/chrome/v1',
    'grafana/extension-sidebar/v0-alpha',
  ];

  grafanaCoreExtensionPoints.forEach((ep) => extensionPoints.add(ep));

  const result = Array.from(extensionPoints).sort();
  availableExtensionPointsCache.set('extensionpoint', result);
  return result;
};

/**
 * Gets all available extension IDs for the extension point mode.
 *
 * @returns Sorted array of extension IDs
 */
export const getAvailableExtensions = (): string[] => {
  if (availableExtensionsCache.has('extensionpoint')) {
    return availableExtensionsCache.get('extensionpoint')!;
  }

  const extensions = new Set<string>();
  const pluginData = getPluginData();

  Object.entries(pluginData).forEach(([pluginId, pluginInfo]) => {
    const pluginExtensions = pluginInfo.extensions;
    if (!pluginExtensions) {
      return;
    }

    // Check added links
    if (hasAddedLinksProperty(pluginExtensions) && pluginExtensions.addedLinks.length > 0) {
      pluginExtensions.addedLinks.forEach((link) => {
        if (isExtensionObject(link) && link.targets) {
          const targets = Array.isArray(link.targets) ? link.targets : [link.targets];
          targets.forEach((target: string) => {
            if (target && target.trim() !== '') {
              const extensionId = `${pluginId}-link-${target}-${link.title || 'Link Extension'}`.replace(
                /[^a-zA-Z0-9-]/g,
                '-'
              );
              extensions.add(extensionId);
            }
          });
        }
      });
    }

    // Check added components
    if (hasAddedComponentsProperty(pluginExtensions) && pluginExtensions.addedComponents.length > 0) {
      pluginExtensions.addedComponents.forEach((component) => {
        if (isExtensionObject(component) && component.targets) {
          const targets = Array.isArray(component.targets) ? component.targets : [component.targets];
          targets.forEach((target: string) => {
            if (target && target.trim() !== '') {
              const extensionId = `${pluginId}-component-${target}-${component.title || 'Component Extension'}`.replace(
                /[^a-zA-Z0-9-]/g,
                '-'
              );
              extensions.add(extensionId);
            }
          });
        }
      });
    }

    // Check added functions
    if (hasAddedFunctionsProperty(pluginExtensions) && pluginExtensions.addedFunctions.length > 0) {
      pluginExtensions.addedFunctions.forEach((func) => {
        if (isExtensionObject(func) && func.targets) {
          const targets = Array.isArray(func.targets) ? func.targets : [func.targets];
          targets.forEach((target: string) => {
            if (target && target.trim() !== '') {
              const extensionId = `${pluginId}-function-${target}-${func.title || 'Function Extension'}`.replace(
                /[^a-zA-Z0-9-]/g,
                '-'
              );
              extensions.add(extensionId);
            }
          });
        }
      });
    }
  });

  const result = Array.from(extensions).sort();
  availableExtensionsCache.set('extensionpoint', result);
  return result;
};

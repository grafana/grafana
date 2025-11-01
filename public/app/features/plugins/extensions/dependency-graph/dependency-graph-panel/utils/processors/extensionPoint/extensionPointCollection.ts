/**
 * Extension Point Collection for Extension Point Processing
 *
 * Handles collection and processing of extension points.
 */

import { AppPluginConfig } from '@grafana/data';
import { t } from '@grafana/i18n';

import { ExtensionPoint } from '../../../types';
import { determineExtensionPointType } from '../../helpers/pluginHelpers';
import { hasExtensionPointsProperty, isExtensionPointObject } from '../../helpers/typeGuards';

import { FilterSetup } from './filterSetup';

/**
 * Collects explicitly defined extension points from plugin data
 */
export function collectExplicitExtensionPoints(
  pluginData: Record<string, AppPluginConfig>,
  filters: FilterSetup
): Map<string, ExtensionPoint> {
  const extensionPoints: Map<string, ExtensionPoint> = new Map();

  Object.entries(pluginData).forEach(([pluginId, pluginInfo]) => {
    const pluginExtensions = pluginInfo.extensions;
    // Type guard to check if pluginExtensions has extensionPoints property
    if (hasExtensionPointsProperty(pluginExtensions) && pluginExtensions.extensionPoints.length > 0) {
      const extensionPointsArray = pluginExtensions.extensionPoints;
      extensionPointsArray.forEach((extensionPoint) => {
        if (isExtensionPointObject(extensionPoint) && extensionPoint.id.trim() !== '') {
          // Filter by selected extension points if specified
          if (filters.shouldFilterExtensionPoints && !filters.selectedExtensionPoints.includes(extensionPoint.id)) {
            return;
          }

          extensionPoints.set(extensionPoint.id, {
            id: extensionPoint.id,
            definingPlugin: pluginId,
            providers: [], // Will be populated later
            extensionType: determineExtensionPointType(extensionPoint.id, pluginData),
            title: extensionPoint.title,
            description: extensionPoint.description,
          });
        }
      });
    }
  });

  return extensionPoints;
}

/**
 * Adds missing extension points for filtered targets
 */
export function addMissingExtensionPoints(extensionPoints: Map<string, ExtensionPoint>, filters: FilterSetup): void {
  if (!filters.shouldFilterExtensionPoints) {
    return;
  }

  filters.selectedExtensionPoints.forEach((targetId) => {
    if (!extensionPoints.has(targetId)) {
      // This target is not explicitly defined as an extension point, but we need to show it
      // For now, we'll create a basic extension point entry
      extensionPoints.set(targetId, {
        id: targetId,
        definingPlugin: 'grafana-core', // Default assumption
        providers: [], // Will be populated later
        extensionType: 'link', // Default assumption
        title: targetId.replace('grafana/', '').replace(/\//g, ' '),
        description: t(
          'extensions.dependency-graph.grafana-core-extension-point',
          'Grafana core extension point: {{epId}}',
          { epId: targetId }
        ),
      });
    }
  });
}

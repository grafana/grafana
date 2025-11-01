/**
 * Filter Setup for Extension Point Processing
 *
 * Handles filter validation and setup for extension point mode.
 */

import { PanelOptions } from '../../../types';

export interface FilterSetup {
  selectedExtensionPoints: string[];
  selectedContentProviders: string[];
  selectedContentConsumersForExtensionPoint: string[];
  shouldFilterExtensionPoints: boolean;
  shouldFilterContentProviders: boolean;
  shouldFilterContentConsumersForExtensionPoint: boolean;
}

/**
 * Sets up and validates filter options for extension point processing
 */
export function setupFilters(options: PanelOptions): FilterSetup {
  const selectedExtensionPoints = options.selectedExtensionPoints || [];
  const selectedContentProviders = options.selectedContentProviders || [];
  const selectedContentConsumersForExtensionPoint = options.selectedContentConsumersForExtensionPoint || [];

  const shouldFilterExtensionPoints = selectedExtensionPoints.length > 0;
  const shouldFilterContentProviders = selectedContentProviders.length > 0;
  const shouldFilterContentConsumersForExtensionPoint = selectedContentConsumersForExtensionPoint.length > 0;

  return {
    selectedExtensionPoints,
    selectedContentProviders,
    selectedContentConsumersForExtensionPoint,
    shouldFilterExtensionPoints,
    shouldFilterContentProviders,
    shouldFilterContentConsumersForExtensionPoint,
  };
}

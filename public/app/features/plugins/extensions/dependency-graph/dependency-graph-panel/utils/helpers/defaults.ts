import { PanelOptions } from '../../types';

/**
 * Default configuration options for the dependency graph panel
 */
export const getDefaultOptions = (): PanelOptions => ({
  // Visualization mode
  visualizationMode: 'addedlinks', // Default to 'addedlinks' mode

  showDependencyTypes: true,
  showDescriptions: false, // Hidden by default
  layoutType: 'hierarchical',

  // Filtering options
  selectedContentProviders: [], // Empty array means all providers are selected
  selectedContentConsumers: [], // Empty array means all consumers are selected
  selectedContentConsumersForExtensionPoint: [], // Empty array means all content consumers are selected in extension point mode
  selectedExtensionPoints: [], // Will be populated with all available extension points by default

  // Color options for extension types
  linkExtensionColor: '#37872d', // Green for link extensions
  componentExtensionColor: '#ff9900', // Orange for component extensions
  functionExtensionColor: '#e02f44', // Red for function extensions
});

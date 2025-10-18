import { GrafanaTheme2 } from '@grafana/data';

import { getThemeColors } from '../../constants';
import { PanelOptions } from '../../types';

/**
 * Default configuration options for the dependency graph panel
 */
export const getDefaultOptions = (theme?: GrafanaTheme2): PanelOptions => {
  const colors = theme
    ? getThemeColors(theme)
    : {
        LINK_EXTENSION: '#37872d',
        COMPONENT_EXTENSION: '#ff9900',
        FUNCTION_EXTENSION: '#e02f44',
      };

  return {
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

    // Color options for extension types using theme colors
    linkExtensionColor: colors.LINK_EXTENSION,
    componentExtensionColor: colors.COMPONENT_EXTENSION,
    functionExtensionColor: colors.FUNCTION_EXTENSION,
  };
};

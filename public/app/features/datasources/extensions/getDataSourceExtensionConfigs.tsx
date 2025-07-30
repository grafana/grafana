import {
  PluginExtensionAddedLinkConfig,
  PluginExtensionPoints,
  PluginExtensionDataSourceConfigActionsContext,
} from '@grafana/data';

import { createAddedLinkConfig } from '../../plugins/extensions/utils';

export function getDataSourceExtensionConfigs(): PluginExtensionAddedLinkConfig[] {
  try {
    return [
      // Example: Add a "View in external tool" action for specific datasource types
      createAddedLinkConfig<PluginExtensionDataSourceConfigActionsContext>({
        // This is called at the top level, so will break if we add a translation here 😱
        // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
        title: 'View in Metrics Drilldown',
        // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
        description: 'Open this datasource in Grafana Metrics Drilldown',
        targets: [PluginExtensionPoints.DataSourceConfigActions],
        icon: 'external-link-alt',
        // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
        category: 'External Tools',
        path: '/a/grafana-metricsdrilldown-app/drilldown', // Placeholder path for initial validation (overridden by configure function)
        configure: (context) => {
          // Only show for prometheus datasources
          if (context?.dataSource?.type !== 'prometheus') {
            return undefined;
          }

          // Return dynamic path with context
          return {
            path: `/a/grafana-metricsdrilldown-app/drilldown?var-ds=${context.dataSource.uid}`,
          };
        },
      }),
    ];
  } catch (error) {
    console.warn(`Could not configure datasource extensions: "${error}"`);
    return [];
  }
}

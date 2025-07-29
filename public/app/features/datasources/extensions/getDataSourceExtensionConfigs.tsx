import {
  PluginExtensionAddedLinkConfig,
  PluginExtensionPoints,
  PluginExtensionDataSourceConfigActionsContext,
  DataSourceConfigErrorStatusContext,
} from '@grafana/data';

import { createAddedLinkConfig } from '../../plugins/extensions/utils';

export function getDataSourceExtensionConfigs(): PluginExtensionAddedLinkConfig[] {
  try {
    return [
      // Example: Add a "View in external tool" action for specific datasource types
      createAddedLinkConfig<PluginExtensionDataSourceConfigActionsContext>({
        // This is called at the top level, so will break if we add a translation here 😱
        // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
        title: 'View in Monitoring Tool',
        // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
        description: 'Open this datasource in external monitoring dashboard',
        targets: [PluginExtensionPoints.DataSourceConfigActions],
        icon: 'external-link-alt',
        // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
        category: 'External Tools',
        path: '/a/grafana/placeholder', // Placeholder path for initial validation (overridden by configure function)
        configure: (context) => {
          // Only show for prometheus datasources
          if (context?.dataSource?.type !== 'prometheus') {
            return undefined;
          }

          // Return dynamic path with context
          return {
            path: `https://monitoring-tool.com/datasource/${context.dataSource.uid}`,
          };
        },
      }),

      // Example: Add troubleshooting link for error status
      createAddedLinkConfig<DataSourceConfigErrorStatusContext>({
        // This is called at the top level, so will break if we add a translation here 😱
        // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
        title: 'Troubleshooting Guide',
        // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
        description: 'Get help resolving this datasource issue',
        targets: [PluginExtensionPoints.DataSourceConfigErrorStatus],
        icon: 'question-circle',
        // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
        category: 'Help',
        path: '/a/grafana/docs/troubleshooting/datasources',
      }),
    ];
  } catch (error) {
    console.warn(`Could not configure datasource extensions: "${error}"`);
    return [];
  }
}

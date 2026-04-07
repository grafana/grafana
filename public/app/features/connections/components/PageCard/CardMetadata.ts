import type { IconName } from '@grafana/data';
import { t } from '@grafana/i18n';

type CardMetadata = {
  icon: IconName;
  subTitle: string;
};

// Visual metadata for well-known connections nav items that don't carry
// icon/subTitle through the nav tree (e.g. plugin standalone pages).
// Keyed by the nav item URL. isOnPrem mirrors config.pluginAdminExternalManageEnabled.
export function getConnectionsCardMetadata(isOnPrem: boolean): Record<string, CardMetadata> {
  return {
    '/connections/add-new-connection': {
      icon: 'plus-circle',
      subTitle: isOnPrem
        ? t('connections.oss.connections-home-page.add-new-connection.subtitle', 'Connect to a new data source')
        : t(
            'connections.cloud.connections-home-page.add-new-connection.subtitle',
            'Connect data to Grafana through data sources, integrations and apps'
          ),
    },
    '/connections/datasources': {
      icon: 'database',
      subTitle: t(
        'connections.cloud.connections-home-page.data-sources.subtitle',
        'Manage your existing data source connections'
      ),
    },
    '/a/grafana-collector-app': {
      icon: 'frontend-observability',
      subTitle: t(
        'connections.cloud.connections-home-page.collector.subtitle',
        'Manage the configuration of Grafana Alloy, our distribution of the OpenTelemetry Collector'
      ),
    },
    '/a/grafana-collector-app/alloy': {
      icon: 'frontend-observability',
      subTitle: t(
        'connections.cloud.connections-home-page.collector-setup.subtitle',
        'Configure and manage your telemetry collectors'
      ),
    },
    '/a/grafana-collector-app/instrumentation-hub': {
      icon: 'sitemap',
      subTitle: t(
        'connections.cloud.connections-home-page.instrumentation-hub.subtitle',
        'Instrument all your services with a single click using ongoing instrumentation and Kubernetes monitoring.'
      ),
    },
    '/a/grafana-collector-app/fleet-management': {
      icon: 'file-alt',
      subTitle: t(
        'connections.cloud.connections-home-page.fleet-management.subtitle',
        'Manage your collector inventory and remotely configure your fleet'
      ),
    },
    '/connections/infrastructure': {
      icon: 'apps',
      subTitle: t('connections.cloud.connections-home-page.integrations.subtitle', 'Manage your active integrations'),
    },
    '/connections/private-data-source-connections': {
      icon: 'lock',
      subTitle: t(
        'connections.cloud.connections-home-page.private-data-source-connections.subtitle',
        'Manage your private network connections for data sources'
      ),
    },
  };
}

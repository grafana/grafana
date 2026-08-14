import type { IconName } from '@grafana/data';
import { t } from '@grafana/i18n';

type CardMetadata = {
  icon: IconName;
  subTitle: string;
  text?: string;
};

// Visual metadata for connections nav items keyed by URL. This map intentionally
// overrides both plugin standalone pages (which carry no icon/subTitle through
// the nav tree) and some core nav items (Add new connection, Data sources) so the
// landing-page cards use the correct icon and copy per edition.
// isOnPrem mirrors !config.pluginAdminExternalManageEnabled.
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
      text: isOnPrem
        ? t('connections.oss.connections-home-page.data-sources.title', 'View configured data sources')
        : undefined,
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

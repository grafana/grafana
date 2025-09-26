import type { IconName } from '@grafana/data';
import { t } from '@grafana/i18n';

type CardData = {
  text: string;
  subTitle: string;
  url: string;
  icon: IconName;
};

export function getCloudCardData(): CardData[] {
  return [
    {
      text: t('connections.cloud.connections-home-page.add-new-connection.title', 'Add new connection'),
      subTitle: t(
        'connections.cloud.connections-home-page.add-new-connection.subtitle',
        'Connect data to Grafana through data sources, integrations and apps'
      ),
      url: '/connections/add-new-connection',
      icon: 'plus-circle',
    },
    {
      text: t('connections.cloud.connections-home-page.collector.title', 'Collector'),
      subTitle: t(
        'connections.cloud.connections-home-page.collector.subtitle',
        'Manage the configuration of Grafana Alloy, our distribution of the OpenTelemetry Collector'
      ),
      url: '/a/grafana-collector-app',
      icon: 'frontend-observability',
    },
    {
      text: t('connections.cloud.connections-home-page.data-sources.title', 'Data sources'),
      subTitle: t(
        'connections.cloud.connections-home-page.data-sources.subtitle',
        'Manage your existing data source connections'
      ),
      url: '/connections/datasources',
      icon: 'database',
    },
    {
      text: t('connections.cloud.connections-home-page.integrations.title', 'Integrations'),
      subTitle: t('connections.cloud.connections-home-page.integrations.subtitle', 'Manage your active integrations'),
      url: '/connections/infrastructure',
      icon: 'apps',
    },
    {
      text: t(
        'connections.cloud.connections-home-page.private-data-source-connections.title',
        'Private data source connect'
      ),
      subTitle: t(
        'connections.cloud.connections-home-page.private-data-source-connections.subtitle',
        'Manage your private network connections for data sources'
      ),
      url: '/connections/private-data-source-connections',
      icon: 'sitemap',
    },
  ];
}

export function getOssCardData(): CardData[] {
  return [
    {
      text: t('connections.oss.connections-home-page.add-new-connection.title', 'Add new connection'),
      subTitle: t('connections.oss.connections-home-page.add-new-connection.subtitle', 'Connect to a new data source'),
      url: '/connections/add-new-connection',
      icon: 'plus-circle',
    },
    {
      text: t('connections.oss.connections-home-page.data-sources.title', 'View configured data sources'),
      subTitle: t(
        'connections.oss.connections-home-page.data-sources.subtitle',
        'Manage your existing data source connections'
      ),
      url: '/connections/datasources',
      icon: 'database',
    },
  ];
}

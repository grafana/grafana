import { useMemo } from 'react';

import { t } from '@grafana/i18n';
import { useTheme2 } from '@grafana/ui';

import type { GuideProps } from './Guide';

export function useGuides() {
  const theme = useTheme2();

  return useMemo<GuideProps[]>(
    () => [
      {
        title: t('home.overview.get-started.cards.app-monitoring.title', 'Set up app monitoring'),
        description: t(
          'home.overview.get-started.cards.app-monitoring.description',
          'Visualize traces, metrics, and logs from services you build and run.'
        ),
        icon: 'apps',
        color: theme.visualization.getColorByName('orange'),
        cta: t('home.overview.get-started.cards.app-monitoring.cta', 'Start setup'),
        href: '/a/grafana-app-observability-app/landing',
      },
      {
        title: t('home.overview.get-started.cards.infra-monitoring.title', 'Monitor infrastructure'),
        description: t(
          'home.overview.get-started.cards.infra-monitoring.description',
          'Monitor infra running on Linux, Kubernetes, cloud platforms, and more.'
        ),
        icon: 'dashboard',
        color: theme.visualization.getColorByName('blue'),
        cta: t('home.overview.get-started.cards.infra-monitoring.cta', 'Start setup'),
        href: '#',
      },
      {
        title: t('home.overview.get-started.cards.database-monitoring.title', 'Analyze database performance'),
        description: t(
          'home.overview.get-started.cards.database-monitoring.description',
          'Query performance, connections, and storage for your data stores.'
        ),
        icon: 'database',
        color: theme.visualization.getColorByName('purple'),
        cta: t('home.overview.get-started.cards.database-monitoring.cta', 'Start setup'),
        href: '/a/grafana-dbo11y-app',
      },
      {
        title: t('home.overview.get-started.cards.website-monitoring.title', 'Monitor website uptime and performance'),
        description: t(
          'home.overview.get-started.cards.website-monitoring.description',
          'Test user experience under load and track availability over time.'
        ),
        icon: 'monitor',
        color: theme.visualization.getColorByName('green'),
        cta: t('home.overview.get-started.cards.website-monitoring.cta', 'Start setup'),
        href: '/a/grafana-synthetic-monitoring-app/checks/new/api-endpoint',
      },
      {
        title: t('home.overview.get-started.cards.cloud-monitoring.title', 'Observe cloud services'),
        description: t(
          'home.overview.get-started.cards.cloud-monitoring.description',
          'Monitor AWS, Azure, or GCP resources, costs, and service metrics.'
        ),
        icon: 'cloud',
        color: theme.visualization.getColorByName('red'),
        cta: t('home.overview.get-started.cards.cloud-monitoring.cta', 'Start setup'),
        href: '/a/grafana-setupguide-app/getting-started/cloud-services',
      },
      {
        title: t('home.overview.get-started.cards.visualize-data.title', 'Visualize existing data'),
        description: t(
          'home.overview.get-started.cards.visualize-data.description',
          'Connect your existing data to Grafana and build dashboards to visualize it.'
        ),
        icon: 'graph-bar',
        color: theme.visualization.getColorByName('yellow'),
        cta: t('home.overview.get-started.cards.visualize-data.cta', 'Start setup'),
        href: '/a/grafana-setupguide-app/getting-started/connect-visualize',
      },
      {
        title: t('home.overview.get-started.cards.prometheus.title', 'Prometheus metrics'),
        description: t(
          'home.overview.get-started.cards.prometheus.description',
          'Connect Prometheus to monitor and visualize metrics in Grafana Cloud.'
        ),
        icon: 'dashboard',
        color: theme.visualization.getColorByName('orange'),
        cta: t('home.overview.get-started.cards.prometheus.cta', 'Start setup'),
        href: '/a/grafana-setupguide-app/getting-started/prometheus',
      },
      {
        title: t('home.overview.get-started.cards.logs.title', 'Logs'),
        description: t(
          'home.overview.get-started.cards.logs.description',
          'Aggregate, search, and analyze logs across all your applications and services.'
        ),
        icon: 'gf-logs',
        color: theme.visualization.getColorByName('yellow'),
        cta: t('home.overview.get-started.cards.logs.cta', 'Start setup'),
        href: '/a/grafana-setupguide-app/getting-started/logs-onboarding',
      },
      {
        title: t('home.overview.get-started.cards.opentelemetry.title', 'OpenTelemetry'),
        description: t(
          'home.overview.get-started.cards.opentelemetry.description',
          'Instrument your app or infrastructure for observability across your stack.'
        ),
        icon: 'open-telemetry',
        color: theme.visualization.getColorByName('blue'),
        cta: t('home.overview.get-started.cards.opentelemetry.cta', 'Start setup'),
        href: '/a/grafana-setupguide-app/getting-started/opentelemetry',
      },
      {
        title: t('home.overview.get-started.cards.kubernetes.title', 'Kubernetes'),
        description: t(
          'home.overview.get-started.cards.kubernetes.description',
          'Get full visibility into the health and performance of your clusters.'
        ),
        icon: 'kubernetes',
        color: theme.visualization.getColorByName('purple'),
        cta: t('home.overview.get-started.cards.kubernetes.cta', 'Start setup'),
        href: '/a/grafana-k8s-app/configuration/cluster-config',
      },
      {
        title: t('home.overview.get-started.cards.hosted-data.title', 'Hosted telemetry data'),
        description: t(
          'home.overview.get-started.cards.hosted-data.description',
          'Store, query, and visualize your telemetry with our fully managed backend.'
        ),
        icon: 'cloud-upload',
        color: theme.visualization.getColorByName('green'),
        cta: t('home.overview.get-started.cards.hosted-data.cta', 'Start setup'),
        href: '/a/grafana-setupguide-app/getting-started/hosted-data',
      },
      {
        title: t('home.overview.get-started.cards.demo-data.title', 'Demo data dashboards'),
        description: t(
          'home.overview.get-started.cards.demo-data.description',
          'Connect real data from our demo environment and explore pre-built dashboards.'
        ),
        icon: 'compass',
        color: theme.visualization.getColorByName('red'),
        cta: t('home.overview.get-started.cards.demo-data.cta', 'Start setup'),
        href: '/a/grafana-demodashboards-app',
      },
    ],
    [theme]
  );
}

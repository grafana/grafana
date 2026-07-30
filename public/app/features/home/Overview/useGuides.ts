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
    ],
    [theme]
  );
}

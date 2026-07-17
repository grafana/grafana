import { css } from '@emotion/css';

import { type GrafanaTheme2, type IconName, locationUtil } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Badge, LinkButton, Stack, Text, useStyles2 } from '@grafana/ui';
import { createBridgeURL } from 'app/features/alerting/unified/components/PluginBridge';
import { ROUTES as CONNECTIONS_ROUTES } from 'app/features/connections/constants';

import { noDataCtaClicked } from '../analytics/main';

import { KUBERNETES_APP_ID } from './kubernetesData';

interface PopularSolution {
  id: string; // stable telemetry id (solution_id)
  label: string;
  icon: IconName;
  href: string;
}

function getPopularSolutions(): PopularSolution[] {
  return [
    {
      id: 'kubernetes-monitoring',
      label: t('home.recommendations.no-data.solution-kubernetes', 'Kubernetes Monitoring'),
      icon: 'kubernetes',
      href: locationUtil.assureBaseUrl(createBridgeURL(KUBERNETES_APP_ID, '/home')),
    },
    {
      id: 'synthetics',
      label: t('home.recommendations.no-data.solution-synthetics', 'Synthetic Monitoring'),
      icon: 'globe',
      href: locationUtil.assureBaseUrl(createBridgeURL('grafana-synthetic-monitoring-app', '/home')),
    },
    {
      id: 'k6',
      label: t('home.recommendations.no-data.solution-k6', 'k6'),
      icon: 'k6',
      href: locationUtil.assureBaseUrl(createBridgeURL('grafana-k6-app', '')),
    },
  ];
}

/** Left recommendations card for instances where no solution is reporting data yet. */
export function NoDataCard() {
  const styles = useStyles2(getStyles);

  return (
    <Stack direction="column" justifyContent="space-between" flex={1} data-testid="recommendation-no-data">
      <Stack direction="column" gap={2}>
        <Badge
          className={styles.badge}
          color="darkgrey"
          text={t('home.recommendations.no-data.badge', 'No solution enabled')}
        />

        <Text element="h3" variant="h3" color="primary">
          <Trans i18nKey="home.recommendations.no-data.title">No data flowing yet</Trans>
        </Text>

        <Text variant="body">
          <Trans i18nKey="home.recommendations.no-data.description">
            Connect a data source to light up your dashboards and alerts, pick from available solutions, or follow a
            getting started guide.
          </Trans>
        </Text>

        <Stack direction="column" gap={1}>
          <Text variant="bodySmall" color="secondary">
            <Trans i18nKey="home.recommendations.no-data.popular-solutions">Popular solutions</Trans>
          </Text>

          <Stack direction="row" alignItems="center" gap={1} wrap="wrap">
            {getPopularSolutions().map((solution) => (
              <LinkButton
                key={solution.id}
                variant="secondary"
                size="sm"
                fill="solid"
                icon={solution.icon}
                href={solution.href}
                onClick={() => noDataCtaClicked({ cta: 'solution', solution_id: solution.id })}
                className={styles.pill}
              >
                {solution.label}
              </LinkButton>
            ))}
          </Stack>
        </Stack>
      </Stack>

      <div className={styles.cta}>
        <Stack direction="row" alignItems="center">
          <LinkButton
            variant="secondary"
            size="md"
            fill="solid"
            icon="arrow-right"
            iconPlacement="right"
            href={locationUtil.assureBaseUrl(CONNECTIONS_ROUTES.AddNewConnection)}
            onClick={() => noDataCtaClicked({ cta: 'connect_data_source' })}
          >
            <Trans i18nKey="home.recommendations.no-data.connect">Connect a data source</Trans>
          </LinkButton>
        </Stack>
      </div>
    </Stack>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  badge: css({
    alignSelf: 'flex-start',
  }),
  pill: css({
    borderRadius: theme.shape.radius.pill,
    border: `1px solid ${theme.colors.border.medium}`,
  }),
  cta: css({
    marginTop: theme.spacing(2),
  }),
});

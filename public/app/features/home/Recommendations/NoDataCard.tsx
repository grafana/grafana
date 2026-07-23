import { css } from '@emotion/css';

import { type GrafanaTheme2, type IconName, locationUtil } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { useAppPluginMetas } from '@grafana/runtime/internal';
import { Badge, LinkButton, Stack, Text, useStyles2 } from '@grafana/ui';
import { createBridgeURL } from 'app/features/alerting/unified/components/PluginBridge';
import { ROUTES as CONNECTIONS_ROUTES } from 'app/features/connections/constants';

import { noDataCtaClicked } from '../analytics/main';

import { KUBERNETES_APP_ID } from './kubernetesData';

interface PopularSolution {
  id: string; // stable telemetry id (solution_id), aligned with pluginRecommendations ids
  pluginId: string;
  label: string;
  icon: IconName;
  appPath: string; // path inside the app, used when the app is available
  searchTerm: string; // catalog search keyword, deliberately untranslated
}

function getPopularSolutions(): PopularSolution[] {
  return [
    {
      id: 'kubernetes-monitoring',
      pluginId: KUBERNETES_APP_ID,
      label: t('home.recommendations.no-data.solution-kubernetes', 'Kubernetes Monitoring'),
      icon: 'kubernetes',
      appPath: '/home',
      searchTerm: 'kubernetes',
    },
    {
      id: 'synthetic-monitoring',
      pluginId: 'grafana-synthetic-monitoring-app',
      label: t('home.recommendations.no-data.solution-synthetics', 'Synthetic Monitoring'),
      icon: 'globe',
      appPath: '/home',
      searchTerm: 'synthetic monitoring',
    },
    {
      id: 'k6',
      pluginId: 'grafana-k6-app',
      label: t('home.recommendations.no-data.solution-k6', 'k6'),
      icon: 'k6',
      appPath: '',
      searchTerm: 'k6',
    },
  ];
}

// Available apps link into the app itself (its routes still enforce page-level
// authorization). Absent apps link to the plugin catalog with the search prefilled:
// a per-plugin detail page cannot be assumed to exist on every instance (air-gapped
// or catalog-disabled stacks), and a dead app route is worse than a browsable catalog.
function getSolutionHref(solution: PopularSolution, appAvailable: boolean): string {
  if (appAvailable) {
    return locationUtil.assureBaseUrl(createBridgeURL(solution.pluginId, solution.appPath));
  }
  const search = new URLSearchParams({ q: solution.searchTerm });
  return locationUtil.assureBaseUrl(`/plugins?${search}`);
}

/** Left recommendations card for instances where no solution is reporting data yet. */
export function NoDataCard() {
  const styles = useStyles2(getStyles);
  // Availability only picks the link target; while the lookup is pending the pills
  // fall back to the catalog, so the card never blocks on it.
  const { value: appMetas } = useAppPluginMetas();
  const availableApps = new Set((appMetas ?? []).map((app) => app.id));

  return (
    <Stack direction="column" justifyContent="space-between" flex={1}>
      <Stack direction="column" gap={2}>
        <Badge
          className={styles.badge}
          color="darkgrey"
          text={t('home.recommendations.no-data.badge', 'Getting started')}
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
                href={getSolutionHref(solution, availableApps.has(solution.pluginId))}
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

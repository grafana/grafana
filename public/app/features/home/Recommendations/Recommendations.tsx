import { css, cx } from '@emotion/css';

import { type GrafanaTheme2, type IconName } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Button, Stack, Text, useStyles2 } from '@grafana/ui';
import { useStoredBoolean } from 'app/core/hooks/useStoredBoolean';

import RecommendationPill from './RecommendationPill';

const HOME_RECOMMENDATIONS_COLLAPSED_LOCAL_STORAGE_KEY = 'grafana.home.recommendations.collapsed';

export interface RecommendationItem {
  title: string;
  icon: IconName;
  color: string | ((theme: GrafanaTheme2) => string);
  context: string;
  description: string;
  action: string;
  href: string;
}

// Stubbed data for initial development
const recommendations: RecommendationItem[] = [
  {
    title: 'Explore your service map',
    icon: 'shield',
    color: (theme) => theme.visualization.getColorByName('green'),
    context: '34 services mapped automatically',
    description: 'Grafana built a live map of your services from their telemetry — dive in.',
    action: 'Open the map',
    href: '#',
  },
  {
    title: 'Watch your cluster from outside',
    icon: 'plus',
    color: (theme) => theme.visualization.getColorByName('purple'),
    context: 'Because you set up Kubernetes Monitoring',
    description: 'Probe your endpoints from 20+ global locations before your users notice.',
    action: 'Add Synthetic Monitoring',
    href: '#',
  },
  {
    title: 'Define an SLO on checkout',
    icon: 'crosshair',
    color: (theme) => theme.visualization.getColorByName('blue'),
    context: 'You have the metrics — set a target',
    description: 'Turn your telemetry into a reliability target and track the error budget.',
    action: 'Open SLOs',
    href: '#',
  },
];

export default function Recommendations() {
  const styles = useStyles2(getStyles);
  const [collapsed, setCollapsed] = useStoredBoolean(HOME_RECOMMENDATIONS_COLLAPSED_LOCAL_STORAGE_KEY, false);

  return (
    <div>
      <Stack direction="row" alignItems="center" gap={2}>
        <Text element="h2" variant="h5">
          <Trans i18nKey="home.recommendations.title">Recommendations for your stack</Trans>
        </Text>

        {collapsed && (
          <Stack direction="row" alignItems="center" gap={1}>
            {recommendations.map((recommendation) => (
              <RecommendationPill key={recommendation.title} recommendation={recommendation} />
            ))}
          </Stack>
        )}

        <div className={cx(styles.spacer, collapsed && styles.line)} />

        <Button
          variant="secondary"
          size="sm"
          fill="text"
          icon={collapsed ? 'angle-down' : 'angle-up'}
          iconPlacement="right"
          onClick={() => setCollapsed(!collapsed)}
          aria-expanded={!collapsed}
        >
          {collapsed ? (
            <Trans i18nKey="home.recommendations.show">Show</Trans>
          ) : (
            <Trans i18nKey="home.recommendations.hide">Hide</Trans>
          )}
        </Button>
      </Stack>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  spacer: css({
    flex: 1,
  }),
  line: css({
    background: theme.colors.border.medium,
    height: '1px',
  }),
});

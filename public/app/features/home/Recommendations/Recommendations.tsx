import { css, cx } from '@emotion/css';
import { useEffect, useState } from 'react';

import { type GrafanaTheme2, type IconName } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Badge, Button, Stack, Text, useStyles2 } from '@grafana/ui';
import { useStoredBoolean } from 'app/core/hooks/useStoredBoolean';

import RecommendationCard from './RecommendationCard';
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

  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (collapsed || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const timeout = setTimeout(() => {
      setIndex((index + 1) % recommendations.length);
    }, 5000);

    return () => clearTimeout(timeout);
  }, [collapsed, index]);

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

      {!collapsed && (
        <div className={styles.card}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" gap={2}>
            <Badge color="brand" icon="bolt" text={t('home.recommendations.recommended', 'Recommended')} />

            <Stack direction="row" alignItems="center" gap={1}>
              <Button
                variant="secondary"
                size="sm"
                fill="text"
                icon="angle-left"
                onClick={() => setIndex((index - 1 + recommendations.length) % recommendations.length)}
                aria-label={t('home.recommendations.previous', 'Previous')}
              />

              <Button
                variant="secondary"
                size="sm"
                fill="text"
                icon="angle-right"
                onClick={() => setIndex((index + 1) % recommendations.length)}
                aria-label={t('home.recommendations.next', 'Next')}
              />
            </Stack>
          </Stack>

          <div className={styles.outer}>
            <div className={styles.inner} style={{ transform: `translateX(-${index * 100}%)` }}>
              {recommendations.map((recommendation, i) => (
                <div key={recommendation.title} className={styles.item} aria-hidden={i !== index}>
                  <RecommendationCard recommendation={recommendation} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
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
  card: css({
    background: theme.colors.background.canvas,
    borderRadius: theme.shape.radius.default,
    margin: theme.spacing(2, 0, 0),
    padding: theme.spacing(2),
    position: 'relative',
    overflow: 'hidden',

    '&::before': {
      content: '""',
      position: 'absolute',
      inset: 0,
      background: theme.colors.gradients.brandHorizontal,
      opacity: 0.05,
      pointerEvents: 'none',
    },
  }),
  outer: css({
    overflow: 'hidden',
    flex: 1,
    margin: theme.spacing(2, 0, 0),
  }),
  inner: css({
    display: 'flex',

    [theme.transitions.handleMotion('no-preference')]: {
      transition: theme.transitions.create(['transform']),
    },
  }),
  item: css({
    minWidth: '100%',
  }),
});

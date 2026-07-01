import { css, cx } from '@emotion/css';
import { useEffect, useState } from 'react';

import { type GrafanaTheme2, type IconName } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Badge, Button, Grid, Icon, Stack, Text, useStyles2 } from '@grafana/ui';
import { useStoredBoolean } from 'app/core/hooks/useStoredBoolean';

import RecommendationCard from './RecommendationCard';
import RecommendationExisting from './RecommendationExisting';
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
  const [paused, setPaused] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    if (collapsed || paused) {
      return;
    }

    const timeout = setTimeout(() => {
      setIndex((index + 1) % recommendations.length);
    }, 5000);

    return () => clearTimeout(timeout);
  }, [collapsed, paused, index]);

  return (
    <div>
      <Stack direction="row" alignItems="center" columnGap={2} rowGap={1} wrap="wrap">
        <Text element="h2" variant="h5">
          <Trans i18nKey="home.recommendations.title">Recommendations for your stack</Trans>
        </Text>

        {collapsed && (
          <div className={styles.pills}>
            <Stack direction="row" alignItems="center" gap={1} wrap="wrap">
              {recommendations.map((recommendation) => (
                <RecommendationPill key={recommendation.title} recommendation={recommendation} />
              ))}
            </Stack>
          </div>
        )}

        <Stack direction="row" alignItems="center" gap={1} flex="1 1 auto">
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
      </Stack>

      {!collapsed && (
        <div className={styles.cards}>
          <Grid gap={0} columns={{ xs: 1, md: 2 }}>
            <div className={styles.card}>
              <RecommendationExisting />

              <div className={styles.arrow}>
                <Icon name="arrow-right" size="xl" />
              </div>
            </div>

            <div className={cx(styles.card, styles.recommended)}>
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

                  {recommendations.map((_, i) =>
                    i === index ? (
                      <Button
                        key={i}
                        variant="secondary"
                        size="sm"
                        fill="solid"
                        icon={paused ? 'play' : 'pause'}
                        onClick={() => setPaused(!paused)}
                        aria-label={
                          paused ? t('home.recommendations.resume', 'Resume') : t('home.recommendations.pause', 'Pause')
                        }
                        data-paused={paused ? true : undefined}
                        className={cx(styles.dot, styles.active)}
                      />
                    ) : (
                      <Button
                        key={i}
                        variant="secondary"
                        size="sm"
                        fill="solid"
                        onClick={() => setIndex(i)}
                        aria-label={t('home.recommendations.go-to', 'Go to recommendation {{index}}', { index: i + 1 })}
                        className={styles.dot}
                      />
                    )
                  )}

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
          </Grid>
        </div>
      )}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  pills: css({
    [theme.breakpoints.down('md')]: {
      order: 1,
    },
  }),
  spacer: css({
    flex: '1 1 0%',
  }),
  line: css({
    [theme.breakpoints.up('md')]: {
      background: theme.colors.border.medium,
      height: '1px',
    },
  }),
  cards: css({
    background: theme.colors.background.canvas,
    borderRadius: theme.shape.radius.default,
    margin: theme.spacing(2, 0, 0),
    overflow: 'hidden',
  }),
  card: css({
    display: 'flex',
    flexDirection: 'column',
    padding: theme.spacing(3, 4),
    position: 'relative',
    minWidth: 0,
  }),
  recommended: css({
    '&::before': {
      content: '""',
      position: 'absolute',
      inset: 0,
      background: theme.colors.gradients.brandHorizontal,
      opacity: 0.05,
      pointerEvents: 'none',
    },
  }),
  arrow: css({
    background: theme.colors.background.secondary,
    borderRadius: theme.shape.radius.circle,
    border: `1px solid ${theme.colors.border.medium}`,
    padding: theme.spacing(0.25),
    lineHeight: 0,
    position: 'absolute',
    zIndex: 1,
    left: '50%',
    top: '100%',
    transform: 'translate(-50%, -50%) rotate(90deg)',

    [theme.breakpoints.up('md')]: {
      top: theme.spacing(2),
      left: '100%',
      transform: 'translate(-50%, 0)',
    },
  }),
  dot: css({
    background: theme.colors.background.secondary,
    lineHeight: 0,
    padding: 0,
    width: theme.spacing(1),
    height: theme.spacing(1),
    borderRadius: theme.shape.radius.pill,
    position: 'relative',

    '&::after': {
      content: '""',
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: theme.spacing(2),
      height: theme.spacing(2),
    },

    [theme.transitions.handleMotion('no-preference', 'reduce')]: {
      transition: theme.transitions.create(['background-color', 'width', 'height'], {
        duration: theme.transitions.duration.short,
      }),
    },
  }),
  active: css({
    '&, &::after': {
      width: theme.spacing(3),
    },

    '&, &:hover, &:focus': {
      background: theme.colors.text.maxContrast,
      color: theme.colors.background.secondary,
    },

    '&:hover, &[data-paused]': {
      height: theme.spacing(2),
    },

    '& > svg': {
      margin: '0 auto',

      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        transition: theme.transitions.create(['opacity'], {
          duration: theme.transitions.duration.short,
        }),
      },
    },

    '&:not(:hover):not([data-paused])': {
      '& > svg': {
        opacity: 0,
      },
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
    display: 'flex',
    minWidth: '100%',
  }),
});

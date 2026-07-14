import { css, cx } from '@emotion/css';
import { useEffect, useState } from 'react';
import { useAsync } from 'react-use';

import { type GrafanaTheme2, type IconName, locationUtil } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { isFetchError } from '@grafana/runtime';
import { getPluginSettings } from '@grafana/runtime/unstable';
import { Badge, Button, Grid, Icon, Stack, Text, useStyles2 } from '@grafana/ui';
import { useStoredBoolean } from 'app/core/hooks/useStoredBoolean';
import { contextSrv } from 'app/core/services/context_srv';
import { usePluginBridge } from 'app/features/alerting/unified/hooks/usePluginBridge';
import { AccessControlAction } from 'app/types/accessControl';

import { RecommendationCard } from './RecommendationCard';
import { RecommendationExisting } from './RecommendationExisting';
import { RecommendationPill } from './RecommendationPill';
import { KUBERNETES_APP_ID } from './kubernetesData';

const HOME_RECOMMENDATIONS_COLLAPSED_LOCAL_STORAGE_KEY = 'grafana.home.recommendations.collapsed';

export interface RecommendationItem {
  id: string; // stable telemetry id (recommendation_id)
  pluginId: string; // app plugin id — drives the CTA href AND the enabled-filter
  title: string;
  icon: IconName;
  color: string | ((theme: GrafanaTheme2) => string);
  context: string; // short "why you are seeing this" line under the title
  description: string;
  action: string; // CTA label, e.g. "Enable Hosted Traces"
  href: string;
}

// Curated next steps after Kubernetes Monitoring. Built at render time (never at module load) so
// `t` resolves after i18n init and `locationUtil.assureBaseUrl` sees config.appSubUrl. hrefs point
// at the plugin page where each app can be enabled, so the section must drop entries whose plugin
// is already enabled and hide entirely from users who cannot manage plugins.
function getRecommendations(): RecommendationItem[] {
  const recommendationDefinitions: Array<Omit<RecommendationItem, 'href'>> = [
    {
      id: 'hosted-traces',
      pluginId: 'grafana-exploretraces-app',
      icon: 'gf-traces',
      color: (theme) => theme.visualization.getColorByName('orange'),
      title: t('home.recommendations.hosted-traces.title', 'Trace requests across services'),
      context: t('home.recommendations.hosted-traces.context', 'Because you set up Kubernetes Monitoring'),
      description: t(
        'home.recommendations.hosted-traces.description',
        'Add distributed tracing to see how requests flow between services and where they slow down.'
      ),
      action: t('home.recommendations.hosted-traces.action', 'Enable Hosted Traces'),
    },
    {
      id: 'synthetic-monitoring',
      pluginId: 'grafana-synthetic-monitoring-app',
      icon: 'globe',
      color: (theme) => theme.visualization.getColorByName('purple'),
      title: t('home.recommendations.synthetic-monitoring.title', 'Watch your cluster from outside'),
      context: t('home.recommendations.synthetic-monitoring.context', 'Catch outages before your users do'),
      description: t(
        'home.recommendations.synthetic-monitoring.description',
        'Probe your endpoints from 20+ global locations before your users notice.'
      ),
      action: t('home.recommendations.synthetic-monitoring.action', 'Add Synthetic Monitoring'),
    },
    {
      id: 'application-observability',
      pluginId: 'grafana-app-observability-app',
      icon: 'application-observability',
      color: (theme) => theme.visualization.getColorByName('green'),
      title: t('home.recommendations.application-observability.title', 'Explore your service map'),
      context: t('home.recommendations.application-observability.context', 'Built automatically from your telemetry'),
      description: t(
        'home.recommendations.application-observability.description',
        'Turn OpenTelemetry data into RED metrics, service maps, and correlated traces automatically.'
      ),
      action: t('home.recommendations.application-observability.action', 'Enable Application Observability'),
    },
    {
      id: 'frontend-observability',
      pluginId: 'grafana-kowalski-app',
      icon: 'frontend-observability',
      color: (theme) => theme.visualization.getColorByName('blue'),
      title: t('home.recommendations.frontend-observability.title', 'Measure real user experience'),
      context: t('home.recommendations.frontend-observability.context', 'Connect the browser to your backend traces'),
      description: t(
        'home.recommendations.frontend-observability.description',
        'Capture Core Web Vitals and errors from the browser and tie them back to backend traces.'
      ),
      action: t('home.recommendations.frontend-observability.action', 'Enable Frontend Observability'),
    },
  ];

  return recommendationDefinitions.map((recommendation) => ({
    ...recommendation,
    href: locationUtil.assureBaseUrl(`/plugins/${recommendation.pluginId}/`),
  }));
}

type PluginCtaState = 'enabled' | 'disabled' | 'not-installed' | 'unknown';

// What acting on a recommendation's CTA would mean for this plugin: enabling a disabled app is a
// settings write; a not-installed app is an install journey. 404 (wrapped as `cause`, like
// usePluginSettings unwraps it) means not installed; any other failure is 'unknown'. Never
// rejects — every failure path resolves to a state.
async function getPluginCtaState(pluginId: string): Promise<PluginCtaState> {
  try {
    const settings = await getPluginSettings(pluginId);
    return settings.enabled ? 'enabled' : 'disabled';
  } catch (err) {
    const cause = err instanceof Error ? err.cause : err;
    if (isFetchError(cause) && cause.status === 404) {
      return 'not-installed';
    }
    return 'unknown';
  }
}

/**
 * Self-gates to null unless Kubernetes Monitoring is installed, the user holds at least one plugin
 * capability (install or settings write), and at least one recommended app survives per-card gating
 * — the recommendations are pitched as next steps after Kubernetes Monitoring, so they make no sense
 * without it.
 */
export function Recommendations() {
  const { installed, loading: bridgeLoading } = usePluginBridge(KUBERNETES_APP_ID);
  // Classify every recommended app once per mount: enabled apps are dropped, and the remaining
  // cards are gated on the permission their CTA actually needs (install vs settings write).
  const { value: ctaStates, loading: statesLoading } = useAsync(async () => {
    const ids = getRecommendations().map((r) => r.pluginId);
    // getPluginCtaState never rejects (all failures resolve to 'unknown'), so Promise.all cannot
    // abort the batch; Promise.allSettled would only add dead branches.
    const states = await Promise.all(ids.map(getPluginCtaState));
    return new Map(ids.map((id, i): [string, PluginCtaState] => [id, states[i]]));
  }, []); // recommended plugin ids are static

  // The /plugins/:id route also admits the legacy Admin/ServerAdmin roles — they pass every CTA.
  const legacyAdmin = contextSrv.hasRole('Admin') || contextSrv.hasRole('ServerAdmin');
  const canInstall = contextSrv.hasPermission(AccessControlAction.PluginsInstall) || legacyAdmin;
  const canWrite = contextSrv.hasPermission(AccessControlAction.PluginsWrite) || legacyAdmin;

  // Hide (not skeleton) during load so the homepage never flashes a section that then vanishes.
  if (bridgeLoading || statesLoading || !installed || (!canInstall && !canWrite)) {
    return null;
  }

  // 'unknown'/undefined (settings lookup failed) keeps the card rather than hiding the section —
  // the early return above already guaranteed the user holds at least one plugin capability.
  const recommendations = getRecommendations().filter((r) => {
    switch (ctaStates?.get(r.pluginId)) {
      case 'enabled':
        return false; // already running — never recommend
      case 'disabled':
        return canWrite; // enabling = plugin settings update
      case 'not-installed':
        return canInstall; // install journey
      default:
        return true;
    }
  });
  if (recommendations.length === 0) {
    return null;
  }

  return <RecommendationsView recommendations={recommendations} />;
}

function RecommendationsView({ recommendations }: { recommendations: RecommendationItem[] }) {
  const styles = useStyles2(getStyles);
  const [collapsed, setCollapsed] = useStoredBoolean(HOME_RECOMMENDATIONS_COLLAPSED_LOCAL_STORAGE_KEY, false);

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  // Clamp on the render itself, not via useEffect: if the list shrinks (an app gets enabled) while
  // `index` is past the new end, reading recommendations[index] would be undefined before an effect fires.
  const safeIndex = Math.min(index, recommendations.length - 1);

  useEffect(() => {
    if (collapsed || paused) {
      return;
    }

    const timeout = setTimeout(() => {
      setIndex((safeIndex + 1) % recommendations.length);
    }, 5000);

    return () => clearTimeout(timeout);
  }, [collapsed, paused, safeIndex, recommendations.length]);

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
                <RecommendationPill key={recommendation.id} recommendation={recommendation} />
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
                    onClick={() => setIndex((safeIndex - 1 + recommendations.length) % recommendations.length)}
                    aria-label={t('home.recommendations.previous', 'Previous')}
                  />

                  {recommendations.map((_, i) =>
                    i === safeIndex ? (
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
                    onClick={() => setIndex((safeIndex + 1) % recommendations.length)}
                    aria-label={t('home.recommendations.next', 'Next')}
                  />
                </Stack>
              </Stack>

              <div className={styles.outer}>
                <div className={styles.inner} style={{ transform: `translateX(-${safeIndex * 100}%)` }}>
                  {recommendations.map((recommendation, i) => (
                    <div
                      key={recommendation.id}
                      className={styles.item}
                      aria-hidden={i !== safeIndex}
                      {...(i !== safeIndex && { inert: '' })}
                    >
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
    // Fill .outer so each slide stretches to the card cell and the card's
    // space-between can pin its CTA to the bottom, matching the Existing card.
    height: '100%',

    [theme.transitions.handleMotion('no-preference')]: {
      transition: theme.transitions.create(['transform']),
    },
  }),
  item: css({
    display: 'flex',
    minWidth: '100%',
  }),
});

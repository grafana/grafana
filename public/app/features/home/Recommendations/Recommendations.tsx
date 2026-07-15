import { css, cx } from '@emotion/css';
import { useEffect, useState } from 'react';
import { useAsync } from 'react-use';

import { type GrafanaTheme2, type IconName, locationUtil } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { config, getBackendSrv } from '@grafana/runtime';
import { Badge, Button, Grid, Icon, Stack, Text, useStyles2 } from '@grafana/ui';
import { useStoredBoolean } from 'app/core/hooks/useStoredBoolean';
import { contextSrv } from 'app/core/services/context_srv';
import { accessControlQueryParam } from 'app/core/utils/accessControl';
import { usePluginBridge } from 'app/features/alerting/unified/hooks/usePluginBridge';
import { type LocalPlugin } from 'app/features/plugins/admin/types';
import { AccessControlAction } from 'app/types/accessControl';

import { RecommendationCard } from './RecommendationCard';
import { RecommendationExisting } from './RecommendationExisting';
import { RecommendationPill } from './RecommendationPill';
import { buildInviteTeamItem, fetchOrgUserCount } from './inviteTeam';
import { KUBERNETES_APP_ID } from './kubernetesData';

const HOME_RECOMMENDATIONS_COLLAPSED_LOCAL_STORAGE_KEY = 'grafana.home.recommendations.collapsed';

export interface RecommendationItem {
  id: string; // stable telemetry id (recommendation_id)
  title: string;
  icon: IconName;
  color: string | ((theme: GrafanaTheme2) => string);
  context: string; // short "why you are seeing this" line under the title
  description: string;
  action: string; // CTA label, e.g. "Enable Hosted Traces"
  href: string;
}

interface PluginRecommendationItem extends RecommendationItem {
  pluginId: string;
}

function getRecommendations(): PluginRecommendationItem[] {
  const recommendationDefinitions: Array<Omit<PluginRecommendationItem, 'href'>> = [
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

// Bypass getLocalPlugins(): it drops hidden plugins, which must still be classified here.
async function fetchInstalledPlugins(): Promise<LocalPlugin[]> {
  return getBackendSrv().get('/api/plugins', accessControlQueryParam({ embedded: 0 }));
}

export function Recommendations() {
  const canInstall = contextSrv.hasPermission(AccessControlAction.PluginsInstall) && config.pluginAdminEnabled;
  // Unscoped pre-gate only; each disabled card re-checks plugins:write scoped to its own plugin.
  const canWriteSome = contextSrv.hasPermission(AccessControlAction.PluginsWrite);
  if (!canInstall && !canWriteSome) {
    return null;
  }
  return <GatedRecommendations canInstall={canInstall} />;
}

function GatedRecommendations({ canInstall }: { canInstall: boolean }) {
  const { installed, loading: bridgeLoading } = usePluginBridge(KUBERNETES_APP_ID);
  const { value: installedPlugins, loading: pluginsLoading } = useAsync(
    async () => (installed ? fetchInstalledPlugins() : undefined),
    [installed]
  );
  const { value: orgUserCount, loading: countLoading } = useAsync(fetchOrgUserCount, []);

  // An unavailable plugin list fails closed. An empty list contradicts the bridge
  // reporting Kubernetes Monitoring installed, so it is treated as unavailable too.
  if (
    bridgeLoading ||
    pluginsLoading ||
    countLoading ||
    !installed ||
    !installedPlugins ||
    installedPlugins.length === 0
  ) {
    return null;
  }

  const pluginsById = new Map(installedPlugins.map((plugin) => [plugin.id, plugin]));
  const pluginRecommendations = getRecommendations().filter((recommendation) => {
    const plugin = pluginsById.get(recommendation.pluginId);
    if (!plugin) {
      // Unlistable plugins take the install-only path.
      return canInstall;
    }
    if (plugin.enabled) {
      return false;
    }
    // plugins:write is scoped to this plugin.
    return contextSrv.hasPermissionInMetadata(AccessControlAction.PluginsWrite, plugin);
  });

  const inviteItem = buildInviteTeamItem(orgUserCount ?? null);
  const recommendations = inviteItem ? [...pluginRecommendations, inviteItem] : pluginRecommendations;
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

  // Clamp during render so a shrinking list cannot select an undefined entry.
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

      <div className={styles.cards} hidden={collapsed}>
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
    // Fill the card cell so its CTA stays bottom-aligned with the existing card.
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

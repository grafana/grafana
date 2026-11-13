import { css } from '@emotion/css';
import { useCallback, useEffect, useState } from 'react';

import { type GrafanaTheme2, type TimeRange, getTimeZone, rangeUtil } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import {
  Alert,
  EmptyState,
  Link,
  LinkButton,
  LoadingPlaceholder,
  RefreshPicker,
  Stack,
  TimeRangePicker,
  useStyles2,
} from '@grafana/ui';
import { getShiftedTimeRange, getZoomedTimeRange } from 'app/core/utils/timePicker';

import { AlertingPageWrapper } from '../../components/AlertingPageWrapper';
import { isNotificationHistoryEnabled } from '../../featureToggles';
import { AlertingAction, useAlertingAbility } from '../../hooks/useAbilities';
import { stringifyErrorLike } from '../../utils/misc';
import { createRelativeUrl } from '../../utils/url';
import IRMCard from '../IRMCard';
import { insightsIsAvailable } from '../Insights';
import { PluginIntegrations } from '../PluginIntegrations';
import SyntheticMonitoringCard from '../SyntheticMonitoringCard';

import { DetailsTabs } from './DetailsTabs';
import { NewStackSetup } from './NewStackSetup';
import { PrometheusAlertingBanner } from './PrometheusAlertingBanner';
import { RunningOverview } from './RunningOverview';
import { getDefaultHomeRange, resolveRange, toTimeRange } from './homeRange';
import { BOX_GAP } from './layout';
import {
  useActiveSilences,
  useDeliverySummary,
  useGrafanaRulesSummary,
  useHasDataSourceManagedRules,
  useMostFiredSource,
  useNotificationConfigCounts,
  useUsageHistory,
} from './useHomeData';

/**
 * The Grafana-managed alerting home page.
 */
function RevampedHome() {
  const styles = useStyles2(getStyles);
  const [createSupported, createAllowed] = useAlertingAbility(AlertingAction.CreateAlertRule);
  const [range, setRange] = useState<TimeRange>(getDefaultHomeRange);
  const [refreshInterval, setRefreshInterval] = useState('');
  // Remounting the content refetches the current-state queries, which opt into refetch on mount.
  const [refreshCount, setRefreshCount] = useState(0);
  // Only delivery counts and the Cloud charts depend on a range; everything else is current state.
  // A stack with no Grafana-managed rules shows the setup steps, where a range means nothing.
  const hasGrafanaRules = Boolean(useGrafanaRulesSummary().value?.totalRules);
  const rangeApplies = hasGrafanaRules && (isNotificationHistoryEnabled() || Boolean(insightsIsAvailable()));

  const refresh = useCallback(() => {
    setRange((current) => resolveRange(current));
    setRefreshCount((count) => count + 1);
  }, []);

  useEffect(() => {
    if (!refreshInterval) {
      return;
    }
    const timer = setInterval(refresh, rangeUtil.intervalToMs(refreshInterval));
    return () => clearInterval(timer);
  }, [refreshInterval, refresh]);

  const actions = (
    <Stack gap={1} alignItems="center">
      {rangeApplies && (
        <TimeRangePicker
          value={range}
          onChange={setRange}
          timeZone={getTimeZone()}
          onChangeTimeZone={() => {}}
          hideTimeZone
          onMoveBackward={() => setRange((current) => toTimeRange(getShiftedTimeRange(-1, current)))}
          onMoveForward={() => setRange((current) => toTimeRange(getShiftedTimeRange(1, current)))}
          onZoom={() => setRange((current) => toTimeRange(getZoomedTimeRange(current, 2)))}
        />
      )}
      <RefreshPicker
        onRefresh={refresh}
        onIntervalChanged={setRefreshInterval}
        value={refreshInterval}
        tooltip={t('alerting.home.refresh', 'Refresh the alerting overview')}
      />
      {createSupported && createAllowed && (
        <LinkButton variant="primary" icon="plus" href={createRelativeUrl('/alerting/new/alerting')}>
          <Trans i18nKey="alerting.home.create-alert-rule">Create alert rule</Trans>
        </LinkButton>
      )}
    </Stack>
  );

  return (
    <AlertingPageWrapper
      navId="alerting"
      subTitle={t('alerting.home.subtitle', 'Learn about problems in your systems moments after they occur')}
      actions={actions}
    >
      <Stack direction="column" gap={BOX_GAP}>
        <PrometheusAlertingBanner />
        <PluginIntegrations />
        {/* both ad cards hide themselves on licensed builds and once dismissed, so collapse the row when it ends up empty */}
        <div className={styles.adCards}>
          <SyntheticMonitoringCard compact />
          <IRMCard compact />
        </div>
        <Shortcuts key={`shortcuts-${refreshCount}`} />
        <HomeContent key={`content-${refreshCount}`} range={range} />
      </Stack>
    </AlertingPageWrapper>
  );
}

function Shortcuts() {
  const styles = useStyles2(getStyles);
  // Same queries as the overview below; RTK Query shares the requests.
  const rules = useGrafanaRulesSummary().value;
  const { contactPoints, notificationPolicies } = useNotificationConfigCounts();
  // Silences have no non-deprecated API, so only Grafana Cloud, which has them as a usage metric, shows a count.
  const usageMetricsAvailable = Boolean(insightsIsAvailable());
  const silences = useActiveSilences(usageMetricsAvailable).value;

  // Links that carry a count show it in bold with a muted label; page links (no count) have a bold label.
  const links: Array<{ label: string; href: `/${string}`; counted?: boolean; count?: string }> = [
    {
      label: t('alerting.home.shortcuts.alert-rules', 'Alert rules'),
      href: '/alerting/list',
      counted: true,
      count: rules && `${rules.totalRules.toLocaleString()}${rules.capped ? '+' : ''}`,
    },
    {
      label: t('alerting.home.shortcuts.contact-points', 'Contact points'),
      href: '/alerting/notifications',
      counted: true,
      count: contactPoints?.toLocaleString(),
    },
    {
      label: t('alerting.home.shortcuts.notification-policies', 'Notification policies'),
      href: '/alerting/routes',
      counted: true,
      count: notificationPolicies?.toLocaleString(),
    },
    ...(usageMetricsAvailable
      ? [
          {
            label: t('alerting.home.shortcuts.silences', 'Silences'),
            href: '/alerting/silences' as const,
            counted: true,
            count: silences?.toLocaleString(),
          },
        ]
      : []),
    { label: t('alerting.home.shortcuts.alert-activity', 'Alert activity'), href: '/alerting/alerts' },
    { label: t('alerting.home.shortcuts.history', 'History'), href: '/alerting/history' },
  ];

  return (
    <nav aria-label={t('alerting.home.shortcuts.label', 'Alerting areas')} className={styles.shortcuts}>
      {links.map((link) => (
        <Link key={link.href} href={link.href} className={styles.shortcut}>
          {link.count !== undefined && <span className={styles.shortcutCount}>{link.count}</span>}
          <span className={link.counted ? styles.shortcutLabel : styles.shortcutPage}>{link.label}</span>
        </Link>
      ))}
    </nav>
  );
}

function HomeContent({ range }: { range: TimeRange }) {
  const rules = useGrafanaRulesSummary();
  const delivery = useDeliverySummary(range);
  const hasGrafanaRules = Boolean(rules.value && rules.value.totalRules > 0);
  const usageMetricsAvailable = Boolean(insightsIsAvailable());
  const usage = useUsageHistory(range, usageMetricsAvailable && hasGrafanaRules);
  const mostFiredSource = useMostFiredSource();

  if (rules.loading) {
    return <LoadingPlaceholder text={t('alerting.home.loading', 'Loading alerting overview...')} />;
  }

  if (rules.error) {
    return (
      <Alert severity="error" title={t('alerting.home.rules-error', 'Could not load Grafana-managed alert rules')}>
        {stringifyErrorLike(rules.error)}
      </Alert>
    );
  }

  if (!rules.value || !hasGrafanaRules) {
    return <NoGrafanaRules />;
  }

  return (
    <Stack direction="column" gap={BOX_GAP}>
      <RunningOverview
        rules={rules.value}
        delivery={delivery.value}
        usageMetricsAvailable={usageMetricsAvailable}
        usage={usage.value}
        mostFiredSource={mostFiredSource}
        range={range}
      />
      <DetailsTabs usageMetricsAvailable={usageMetricsAvailable} delivery={delivery.value} range={range} />
    </Stack>
  );
}

/**
 * New stacks are Grafana-managed only, so no rules means a new stack, unless the stack keeps its
 * rules in data sources. Those stacks are not new: they get an empty state, not the setup steps.
 */
function NoGrafanaRules() {
  const dataSourceRules = useHasDataSourceManagedRules();

  if (dataSourceRules.loading) {
    return <LoadingPlaceholder text={t('alerting.home.loading', 'Loading alerting overview...')} />;
  }

  if (dataSourceRules.value) {
    return (
      <EmptyState
        variant="call-to-action"
        message={t('alerting.home.no-grafana-rules.title', 'No Grafana-managed alert rules yet')}
        button={
          <LinkButton variant="primary" icon="plus" href={createRelativeUrl('/alerting/new/alerting')}>
            <Trans i18nKey="alerting.home.create-alert-rule">Create alert rule</Trans>
          </LinkButton>
        }
      >
        <Trans i18nKey="alerting.home.no-grafana-rules.body">
          This page summarizes Grafana-managed alerts. Your data source-managed rules keep evaluating and notifying as
          before.
        </Trans>
      </EmptyState>
    );
  }

  return <NewStackSetup />;
}

const getStyles = (theme: GrafanaTheme2) => ({
  shortcuts: css({
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
  }),
  shortcut: css({
    display: 'inline-flex',
    alignItems: 'baseline',
    gap: theme.spacing(1),
    padding: theme.spacing(0.75, 1.5),
    background: theme.colors.background.secondary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    color: theme.colors.text.primary,
    '&:hover': { borderColor: theme.colors.border.medium },
  }),
  shortcutCount: css({
    fontWeight: theme.typography.fontWeightBold,
    marginRight: theme.spacing(-0.25),
  }),
  shortcutLabel: css({
    color: theme.colors.text.secondary,
  }),
  shortcutPage: css({
    fontWeight: theme.typography.fontWeightBold,
  }),
  adCards: css({
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(BOX_GAP),
    '& > *': { minWidth: 320 },

    '&:empty': {
      display: 'none',
    },
  }),
});

export default RevampedHome;

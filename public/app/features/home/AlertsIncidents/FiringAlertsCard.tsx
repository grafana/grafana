import { t, Trans } from '@grafana/i18n';
import { useFlagGrafanaGrowthHomepage } from '@grafana/runtime/internal';
import { Badge, LinkButton, Stack, Tooltip } from '@grafana/ui';
import { SeverityBars } from 'app/features/alerting/unified/triage/scene/filters/SeverityBars';
import { type SeverityLevel } from 'app/features/alerting/unified/triage/scene/filters/severity';
import { type AlertmanagerAlert } from 'app/plugins/datasource/alertmanager/types';
import { ListRow } from 'app/plugins/panel/dashlist/ListRow';

import { CreateAndViewAlertsButtons } from './CreateAndViewAlertsButtons';
import { SummaryCard, SummaryCardAge, SummaryCardPrefix } from './SummaryCard';
import { severityLevelColor } from './severity';
import { canViewFiringAlerts, useFiringAlerts, type FiringAlertsData } from './useFiringAlerts';

/** Extract the path (with query string) from an absolute generatorURL, falling back to the raw value. */
function alertDetailHref(alert: AlertmanagerAlert) {
  const raw = alert.generatorURL;
  if (!raw) {
    return undefined;
  }
  try {
    const url = new URL(raw);
    return url.pathname + url.search;
  } catch {
    return raw;
  }
}

function severityLabel(level?: SeverityLevel): string {
  switch (level) {
    case 'critical':
      return t('home.firing-alerts-card.severity-critical', 'Critical');
    case 'major':
      return t('home.firing-alerts-card.severity-high', 'High');
    case 'minor':
      return t('home.firing-alerts-card.severity-minor', 'Minor');
    case 'low':
      return t('home.firing-alerts-card.severity-low', 'Low');
    default:
      return t('home.firing-alerts-card.severity-unknown', 'Unknown');
  }
}

export function FiringAlertsCard() {
  if (!canViewFiringAlerts()) {
    return null;
  }

  return <FiringAlertsCardInner />;
}

/**
 * Inner component avoids calling hooks conditionally —
 * the permission gate is in the parent wrapper.
 */
function FiringAlertsCardInner() {
  const data = useFiringAlerts();
  return <FiringAlertsCardView data={data} />;
}

/** Render-only card body; data comes from useFiringAlerts so callers control where the hook runs. */
export function FiringAlertsCardView({
  data,
  hideFooterActions = false,
}: {
  data: FiringAlertsData;
  hideFooterActions?: boolean;
}) {
  const redesignEnabled = useFlagGrafanaGrowthHomepage();
  const {
    count,
    criticalCount,
    highCount,
    visibleAlerts,
    hasAlerts,
    hasTeams,
    loading,
    error,
    refetch,
    canCreate,
    newRuleHref,
    viewAllHref,
    trackClick,
  } = data;

  return (
    <SummaryCard
      title={t('home.firing-alerts-card.title', 'Firing alerts')}
      count={count}
      headerExtra={
        <Stack>
          {criticalCount > 0 && (
            <Badge
              text={t('home.firing-alerts-card.critical-count', '', {
                count: criticalCount,
                defaultValue_one: '{{count}} critical',
                defaultValue_other: '{{count}} critical',
              })}
              color="red"
            />
          )}
          {highCount > 0 && (
            <Badge
              text={t('home.firing-alerts-card.high-count', '', {
                count: highCount,
                defaultValue_one: '{{count}} high',
                defaultValue_other: '{{count}} high',
              })}
              color="orange"
            />
          )}
        </Stack>
      }
      loading={loading}
      error={
        error
          ? {
              title: t('home.firing-alerts-card.error-title', 'Could not load firing alerts'),
              onRetry: () => refetch(),
            }
          : undefined
      }
      emptyMessage={
        hasTeams
          ? t('home.firing-alerts-card.empty-teams', 'No firing alerts for your teams.')
          : t('home.firing-alerts-card.empty', 'You have no firing alerts.')
      }
      items={visibleAlerts}
      getItemKey={({ alert }) => alert.fingerprint}
      renderItem={({ alert, level, startedAt }) => {
        const detailHref = alertDetailHref(alert);
        return (
          <ListRow
            isCompact
            showDivider={redesignEnabled}
            title={alert.labels.alertname}
            subtitle={alert.labels.team}
            // when redesignEnabled is false, we want to show the subtitle inline with the title
            // when its true, we want to show the subtitle below the title
            oneRow={!redesignEnabled}
            prefix={
              redesignEnabled ? (
                <Tooltip content={severityLabel(level)}>
                  <span>
                    <SeverityBars level={level} />
                    <span className="sr-only">{severityLabel(level)}</span>
                  </span>
                </Tooltip>
              ) : (
                <SummaryCardPrefix>
                  <Badge text={severityLabel(level)} color={severityLevelColor(level)} />
                </SummaryCardPrefix>
              )
            }
            trailing={<SummaryCardAge date={startedAt} />}
            href={detailHref}
            onClick={(e) => trackClick(e, { action: 'alert_detail', placement: 'list', severity: level })}
          />
        );
      }}
      emptyAction={
        canCreate ? (
          <LinkButton
            variant="primary"
            icon="plus"
            href={newRuleHref}
            onClick={(e) => trackClick(e, { action: 'create_rule', placement: 'empty_state' })}
          >
            <Trans i18nKey="home.firing-alerts-card.create">Create an alert rule</Trans>
          </LinkButton>
        ) : undefined
      }
      footer={
        !hideFooterActions && (
          <CreateAndViewAlertsButtons
            hasAlerts={hasAlerts}
            canCreate={canCreate}
            newRuleHref={newRuleHref}
            viewAllHref={viewAllHref}
            track={trackClick}
          />
        )
      }
    />
  );
}

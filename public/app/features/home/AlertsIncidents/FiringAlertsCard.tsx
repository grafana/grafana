import { t, Trans } from '@grafana/i18n';
import { LinkButton, Tooltip } from '@grafana/ui';
import { SeverityBars } from 'app/features/alerting/unified/triage/scene/filters/SeverityBars';
import { type SeverityLevel } from 'app/features/alerting/unified/triage/scene/filters/severity';
import { type AlertmanagerAlert } from 'app/plugins/datasource/alertmanager/types';
import { ListRow } from 'app/plugins/panel/dashlist/ListRow';

import { TimeAgoCell } from '../TimeAgoCell';
import { ctaClicked } from '../analytics/main';

import { AllClearGrot, SummaryCard } from './SummaryCard';
import { type FilterScope, formatFilterLabel } from './filterSelection';
import { type FiringAlertsData } from './useFiringAlerts';

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

/**
 * Empty-state copy scoped to the active filter. A picked label overrides the
 * "your teams" default filter, so the copy names the picked label instead
 * of claiming it's the user's own teams.
 */
function emptyMessage(filterScope: FilterScope, hasTeams: boolean): string {
  switch (filterScope.kind) {
    case 'all':
      return t('home.firing-alerts-card.empty', 'All clear! No alerts are firing.');
    case 'label':
      return t('home.firing-alerts-card.empty-selected-label', 'All clear! No alerts are firing with {{label}}.', {
        label: formatFilterLabel(filterScope.label),
        interpolation: { escapeValue: false },
      });
    case 'default':
      return hasTeams
        ? t('home.firing-alerts-card.empty-teams', 'All clear! No alerts are firing for your teams.')
        : t('home.firing-alerts-card.empty', 'All clear! No alerts are firing.');
  }
}

/** Render-only card body; data comes from useFiringAlerts so callers control where the hook runs. */
export function FiringAlertsCard({ data }: { data: FiringAlertsData }) {
  const { visibleAlerts, hasTeams, filterScope, loading, error, refetch, canCreate, newRuleHref } = data;

  return (
    <SummaryCard
      loading={loading}
      error={
        error
          ? {
              title: t('home.firing-alerts-card.error-title', 'Could not load firing alerts'),
              onRetry: () => refetch(),
            }
          : undefined
      }
      items={visibleAlerts}
      getItemKey={({ alert }) => alert.fingerprint}
      renderItem={({ alert, level, startedAt }) => {
        const detailHref = alertDetailHref(alert);
        return (
          <ListRow
            title={alert.labels.alertname}
            subtitle={alert.labels.team}
            prefix={
              <Tooltip content={severityLabel(level)}>
                <span>
                  <SeverityBars level={level} />
                  <span className="sr-only">{severityLabel(level)}</span>
                </span>
              </Tooltip>
            }
            trailing={<TimeAgoCell date={startedAt} />}
            href={detailHref}
            onClick={() => ctaClicked({ surface: 'alerts_card', action: 'alert_detail', placement: 'list' })}
          />
        );
      }}
      emptyMessage={emptyMessage(filterScope, hasTeams)}
      emptyImage={<AllClearGrot />}
      emptyAction={
        canCreate ? (
          <LinkButton
            variant="primary"
            size="sm"
            icon="plus"
            href={newRuleHref}
            onClick={() => ctaClicked({ surface: 'alerts_card', action: 'create_rule', placement: 'empty_state' })}
          >
            <Trans i18nKey="home.firing-alerts-card.create">Create an alert rule</Trans>
          </LinkButton>
        ) : undefined
      }
    />
  );
}

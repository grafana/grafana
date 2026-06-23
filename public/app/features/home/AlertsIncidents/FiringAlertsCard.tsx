import { css } from '@emotion/css';
import { skipToken } from '@reduxjs/toolkit/query';
import { escapeRegExp } from 'lodash';
import { useMemo } from 'react';
import { useAsync } from 'react-use';

import { t, Trans } from '@grafana/i18n';
import { getBackendSrv } from '@grafana/runtime';
import { Badge, LinkButton, Stack, Text, Tooltip, useStyles2 } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { alertmanagerApi } from 'app/features/alerting/unified/api/alertmanagerApi';
import { SeverityBars } from 'app/features/alerting/unified/triage/scene/filters/SeverityBars';
import {
  canonicalSeverity,
  SEVERITY_DEFINITIONS,
  type SeverityLevel,
} from 'app/features/alerting/unified/triage/scene/filters/severity';
import { ALERTMANAGER_NAME_QUERY_KEY, GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/constants';
import { type AlertmanagerAlert } from 'app/plugins/datasource/alertmanager/types';
import { AccessControlAction } from 'app/types/accessControl';
import { type Team } from 'app/types/teams';

import { SummaryCard, SummaryCardAge, SummaryCardTitle } from './SummaryCard';
import { HOME_CARD_MAX_ITEMS } from './constants';

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

/** Canonical severity level for an alert, tolerant of a missing severity label so the card never crashes. */
function alertSeverityLevel(alert: AlertmanagerAlert) {
  return canonicalSeverity(alert.labels.severity ?? '');
}

function severityRank(level?: SeverityLevel) {
  return level ? SEVERITY_DEFINITIONS.findIndex((d) => d.level === level) : -1;
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
      return t('home.firing-alerts-card.severity-unknown', 'Unknown severity');
  }
}

function buildTeamMatchers(teamNames: string[]) {
  if (teamNames.length === 0) {
    return [];
  }
  return [{ name: 'team', value: teamNames.map(escapeRegExp).join('|'), isRegex: true, isEqual: true }];
}

export function FiringAlertsCard() {
  if (!contextSrv.hasPermission(AccessControlAction.AlertingInstanceRead)) {
    return null;
  }

  return <FiringAlertsCardInner />;
}

/**
 * Inner component avoids calling hooks conditionally —
 * the permission gate is in the parent wrapper.
 */
function FiringAlertsCardInner() {
  const styles = useStyles2(getStyles);

  // Fetched once — teams change at login granularity. A failed fetch leaves teams
  // undefined, so the card intentionally shows all org alerts unfiltered.
  const { value: teams, loading: teamsLoading } = useAsync(() => getBackendSrv().get<Team[]>('/api/user/teams'), []);

  const teamNames = (teams ?? []).map((t) => t.name);
  const hasTeams = teamNames.length > 0;

  // Filter to the user's teams when they have any. No memo needed:
  // RTK Query serializes query args, so referential identity doesn't matter.
  const matchers = hasTeams ? buildTeamMatchers(teamNames) : [];

  const {
    data: alerts,
    isLoading: alertsLoading,
    error: alertsError,
    refetch,
  } = alertmanagerApi.useGetAlertmanagerAlertsQuery(
    teamsLoading
      ? skipToken
      : {
          amSourceName: GRAFANA_RULES_SOURCE_NAME,
          filter: { active: true, silenced: false, inhibited: false, matchers },
          showErrorAlert: false,
        }
  );

  const loading = teamsLoading || alertsLoading;

  // Severity and timestamp are derived once per alert so the sort comparator,
  // the badge counts, and the rows don't recompute them.
  const { displayed, criticalCount, highCount } = useMemo(() => {
    let criticalCount = 0;
    let highCount = 0;
    const decorated = (alerts ?? []).map((alert) => {
      const level = alertSeverityLevel(alert);
      if (level === 'critical') {
        criticalCount++;
      } else if (level === 'major') {
        highCount++;
      }
      return { alert, level, rank: severityRank(level), startedAt: new Date(alert.startsAt).getTime() };
    });
    // Most severe first, most recent first within the same severity
    decorated.sort((a, b) => b.rank - a.rank || b.startedAt - a.startedAt);
    // Cap the rendered rows; counts above are over every alert so the badges stay accurate.
    return { displayed: decorated.slice(0, HOME_CARD_MAX_ITEMS), criticalCount, highCount };
  }, [alerts]);

  return (
    <SummaryCard
      title={t('home.firing-alerts-card.title', 'Firing alerts')}
      count={alerts?.length ?? 0}
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
        alertsError
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
      items={displayed}
      getItemKey={({ alert }) => alert.fingerprint}
      renderItem={({ alert, level, startedAt }) => {
        const detailHref = alertDetailHref(alert);
        const severity = severityLabel(level);
        return (
          <>
            <Tooltip content={severity}>
              <span role="img" aria-label={severity} className={styles.severityIndicator}>
                <SeverityBars level={level} />
              </span>
            </Tooltip>
            <SummaryCardTitle href={detailHref}>{alert.labels.alertname}</SummaryCardTitle>
            {alert.labels.team && (
              <Text color="secondary" variant="bodySmall" truncate>
                {alert.labels.team}
              </Text>
            )}
            <SummaryCardAge date={startedAt} />
          </>
        );
      }}
      footer={
        <LinkButton
          variant="secondary"
          size="sm"
          fill="text"
          href={
            alerts?.length
              ? `/alerting/groups?${ALERTMANAGER_NAME_QUERY_KEY}=${GRAFANA_RULES_SOURCE_NAME}`
              : `/alerting/list?search=source:${GRAFANA_RULES_SOURCE_NAME}`
          }
        >
          {alerts?.length ? (
            <Trans i18nKey="home.firing-alerts-card.view-all">View all firing alerts</Trans>
          ) : (
            <Trans i18nKey="home.firing-alerts-card.view-rules">View all alert rules</Trans>
          )}
        </LinkButton>
      }
    />
  );
}

const getStyles = () => ({
  severityIndicator: css({
    display: 'inline-flex',
    flexShrink: 0,
  }),
});

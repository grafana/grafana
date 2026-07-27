import { skipToken } from '@reduxjs/toolkit/query';
import { escapeRegExp } from 'lodash';
import { useMemo } from 'react';
import { useAsync } from 'react-use';

import { getBackendSrv } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { alertmanagerApi } from 'app/features/alerting/unified/api/alertmanagerApi';
import { canonicalSeverity } from 'app/features/alerting/unified/triage/scene/filters/severity';
import { ALERTMANAGER_NAME_QUERY_KEY, GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/constants';
import { ALERTING_PATHS, alertListPageLink } from 'app/features/alerting/unified/utils/navigation';
import { createRelativeUrl } from 'app/features/alerting/unified/utils/url';
import { type AlertmanagerAlert } from 'app/plugins/datasource/alertmanager/types';
import { AccessControlAction } from 'app/types/accessControl';
import { type Team } from 'app/types/teams';

import { HOME_CARD_MAX_ITEMS } from './constants';
import { severityLevelRank } from './severity';

/** Canonical severity level for an alert, tolerant of a missing severity label so the card never crashes. */
function alertSeverityLevel(alert: AlertmanagerAlert) {
  return canonicalSeverity(alert.labels.severity ?? '');
}

function buildTeamMatchers(teamNames: string[]) {
  if (teamNames.length === 0) {
    return [];
  }
  return [{ name: 'team', value: teamNames.map(escapeRegExp).join('|'), isRegex: true, isEqual: true }];
}

// Exported so the homepage skeleton reserves the card slot using the same gate.
export const canViewFiringAlerts = () => contextSrv.hasPermission(AccessControlAction.AlertingInstanceRead);

export type FiringAlertsData = ReturnType<typeof useFiringAlerts>;

/**
 * All data fetching and derived state for the homepage Firing alerts view,
 * shared between the old-layout card and the redesigned tabs.
 */
export function useFiringAlerts() {
  // The hook gates its own fetching so it's safe to call unconditionally,
  // e.g. from the tabs component when only incidents are available.
  const enabled = canViewFiringAlerts();

  // Fetched once — teams change at login granularity. A failed fetch leaves teams
  // undefined, so the card intentionally shows all org alerts unfiltered.
  const { value: teams, loading: teamsLoading } = useAsync(
    () => (enabled ? getBackendSrv().get<Team[]>('/api/user/teams') : Promise.resolve<Team[]>([])),
    [enabled]
  );

  const teamNames = (teams ?? []).map((t) => t.name);
  const hasTeams = teamNames.length > 0;

  // Filter to the user's teams when they have any. No memo needed:
  // RTK Query serializes query args, so referential identity doesn't matter.
  const matchers = hasTeams ? buildTeamMatchers(teamNames) : [];

  const {
    data: alerts,
    isLoading: alertsLoading,
    error,
    refetch,
  } = alertmanagerApi.useGetAlertmanagerAlertsQuery(
    !enabled || teamsLoading
      ? skipToken
      : {
          amSourceName: GRAFANA_RULES_SOURCE_NAME,
          filter: { active: true, silenced: false, inhibited: false, matchers },
          showErrorAlert: false,
        }
  );

  // enabled && ... so the useAsync microtask tick doesn't report loading for gated users
  const loading = enabled && (teamsLoading || alertsLoading);

  // Severity and timestamp are derived once per alert so the sort comparator,
  // the badge counts, and the rows don't recompute them.
  const { visibleAlerts, criticalCount, highCount } = useMemo(() => {
    let criticalCount = 0;
    let highCount = 0;
    const decorated = (alerts ?? []).map((alert) => {
      const level = alertSeverityLevel(alert);
      if (level === 'critical') {
        criticalCount++;
      } else if (level === 'major') {
        highCount++;
      }
      return { alert, level, rank: severityLevelRank(level), startedAt: new Date(alert.startsAt).getTime() };
    });
    // Most severe first, most recent first within the same severity
    decorated.sort((a, b) => b.rank - a.rank || b.startedAt - a.startedAt);
    // Cap the rendered rows; counts above are over every alert so the badges stay accurate.
    return { visibleAlerts: decorated.slice(0, HOME_CARD_MAX_ITEMS), criticalCount, highCount };
  }, [alerts]);

  const canCreate = contextSrv.hasPermission(AccessControlAction.AlertingRuleCreate);
  const count = alerts?.length ?? 0;
  const hasAlerts = count > 0;

  // Built at render time, not module scope: createRelativeUrl reads config.appSubUrl on call,
  // and LinkButton emits a plain <a href> with no router to prepend the sub path for us.
  const newRuleHref = createRelativeUrl('/alerting/new/alerting');
  const viewAllHref = hasAlerts
    ? createRelativeUrl(ALERTING_PATHS.ALERT_GROUPS, { [ALERTMANAGER_NAME_QUERY_KEY]: GRAFANA_RULES_SOURCE_NAME })
    : alertListPageLink({ search: `source:${GRAFANA_RULES_SOURCE_NAME}` });

  return {
    visibleAlerts,
    count,
    criticalCount,
    highCount,
    hasAlerts,
    hasTeams,
    loading,
    error,
    refetch,
    canCreate,
    newRuleHref,
    viewAllHref,
  };
}

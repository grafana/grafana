import { skipToken } from '@reduxjs/toolkit/query';
import { escapeRegExp, uniq } from 'lodash';
import { useMemo } from 'react';
import { useAsync } from 'react-use';

import { getBackendSrv } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { alertmanagerApi } from 'app/features/alerting/unified/api/alertmanagerApi';
import { canonicalSeverity } from 'app/features/alerting/unified/triage/scene/filters/severity';
import { ALERTMANAGER_NAME_QUERY_KEY, GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/constants';
import { ALERTING_PATHS, alertListPageLink } from 'app/features/alerting/unified/utils/navigation';
import { createRelativeUrl } from 'app/features/alerting/unified/utils/url';
import { ALL_VARIABLE_VALUE } from 'app/features/variables/constants';
import { type AlertmanagerAlert } from 'app/plugins/datasource/alertmanager/types';
import { AccessControlAction } from 'app/types/accessControl';
import { type Team } from 'app/types/teams';

import { severityLevelRank } from './severity';

/** Canonical severity level for an alert, tolerant of a missing severity label so the card never crashes. */
function alertSeverityLevel(alert: AlertmanagerAlert) {
  return canonicalSeverity(alert.labels.severity ?? '');
}

function buildTeamMatchers(teamValues: string[]) {
  if (teamValues.length === 0) {
    return [];
  }
  return [{ name: 'team', value: teamValues.map(escapeRegExp).join('|'), isRegex: true, isEqual: true }];
}

// Any run of separator characters between or around the name's letter/digit runs.
// Alertmanager compiles matchers with Go's RE2, which supports \p{...} classes;
// don't reuse this pattern in a JS RegExp without the `u` flag.
const SEPARATORS = '[^\\p{L}\\p{N}]*';

/**
 * Regex pattern matching any labeling convention of a team name: only the
 * letter/digit runs must appear, with arbitrary separators (or none) between
 * and around them. "Team (US)" matches "Team (US)", "team-us" or "TeamUS" —
 * but not "team-us-2", since Alertmanager anchors regex matchers.
 * Null for names without any letters or digits.
 */
function toTolerantPattern(teamName: string): string | null {
  // Runs of letters/digits contain no regex metacharacters, so no escaping is needed.
  const runs = teamName.match(/[\p{L}\p{N}]+/gu);
  return runs && SEPARATORS + runs.join(SEPARATORS) + SEPARATORS;
}

function buildTolerantTeamMatchers(teamNames: string[]) {
  const patterns = uniq(teamNames.map(toTolerantPattern).filter((p): p is string => p !== null));
  if (patterns.length === 0) {
    return [];
  }
  // (?i) (a Go RE2 inline flag): the label's casing is as unpredictable as its separators.
  return [{ name: 'team', value: `(?i)${patterns.join('|')}`, isRegex: true, isEqual: true }];
}

/**
 * Which team matchers to send for the current dropdown selection:
 * an explicit "All teams" pick means no filter at all, a specific team wins next,
 * and with no selection we fall back to the user's own teams when they have any.
 */
function resolveTeamMatchers(selectedTeam: string | undefined, userTeamNames: string[]) {
  if (selectedTeam === ALL_VARIABLE_VALUE) {
    return [];
  }
  if (selectedTeam) {
    // Dropdown selections are real `team` label values, so they're matched exactly.
    return buildTeamMatchers([selectedTeam]);
  }
  // The `team` alert label is free-form — typically some slugged or re-cased variant
  // of the Grafana team name — so the own-teams default matches tolerantly.
  return buildTolerantTeamMatchers(userTeamNames);
}

// Exported so the homepage skeleton reserves the card slot using the same gate.
export const canViewFiringAlerts = () => contextSrv.hasPermission(AccessControlAction.AlertingInstanceRead);

export type FiringAlertsData = ReturnType<typeof useFiringAlerts>;

/**
 * All data fetching and derived state for the homepage Firing alerts view,
 * shared between the old-layout card and the redesigned tabs.
 *
 * When `selectedTeam` is set (from the team dropdown) it overrides the default
 * filter of the user's own teams.
 */
export function useFiringAlerts(selectedTeam?: string) {
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

  // No memo needed: RTK Query serializes query args, so referential identity doesn't matter.
  const matchers = resolveTeamMatchers(selectedTeam, teamNames);

  const {
    data: alerts,
    isFetching: alertsLoading,
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
    // Echoed back so the card can scope its empty message to the filtered team.
    selectedTeam,
    loading,
    error,
    refetch,
    canCreate,
    newRuleHref,
    viewAllHref,
  };
}

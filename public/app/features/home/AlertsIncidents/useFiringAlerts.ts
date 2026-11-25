import { skipToken } from '@reduxjs/toolkit/query';
import { uniq } from 'lodash';
import { useMemo } from 'react';
import { useAsync } from 'react-use';

import { getBackendSrv } from '@grafana/runtime';
import { useFlagGrafanaMultiTenantHomepage } from '@grafana/runtime/internal';
import { contextSrv } from 'app/core/services/context_srv';
import { alertmanagerApi } from 'app/features/alerting/unified/api/alertmanagerApi';
import { canonicalSeverity } from 'app/features/alerting/unified/triage/scene/filters/severity';
import { matcherToMatcherField } from 'app/features/alerting/unified/utils/alertmanager';
import { ALERTMANAGER_NAME_QUERY_KEY, GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/constants';
import { encodeMatcher } from 'app/features/alerting/unified/utils/matchers';
import { ALERTING_PATHS, alertListPageLink } from 'app/features/alerting/unified/utils/navigation';
import { createRelativeUrl } from 'app/features/alerting/unified/utils/url';
import { type AlertmanagerAlert, type Matcher } from 'app/plugins/datasource/alertmanager/types';
import { AccessControlAction } from 'app/types/accessControl';
import { type Team } from 'app/types/teams';

import { HOME_CARD_MAX_ITEMS } from './constants';
import { type FilterScope, type FilterSelection, resolveFilterScope } from './filterSelection';
import { severityLevelRank } from './severity';

/** Canonical severity level for an alert, tolerant of a missing severity label so the card never crashes. */
function alertSeverityLevel(alert: AlertmanagerAlert) {
  return canonicalSeverity(alert.labels.severity ?? '');
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

// Alertmanager takes matchers only in the query string. Past this many encoded characters the own-teams
// filter runs in the browser, keeping the request line well under proxy limits like nginx's 8 KiB default.
const MAX_SERVER_TEAM_FILTER_LENGTH = 4096;

/** `matchers` go to Alertmanager; `clientTeamPattern`, when set, is matched against each fetched alert's team label. */
type AlertFilter = { matchers: Matcher[]; clientTeamPattern?: string };

function buildTolerantTeamFilter(teamNames: string[]): AlertFilter {
  const patterns = uniq(teamNames.map(toTolerantPattern).filter((p): p is string => p !== null));
  if (patterns.length === 0) {
    return { matchers: [] };
  }
  const pattern = patterns.join('|');
  // (?i) (a Go RE2 inline flag): the label's casing is as unpredictable as its separators.
  const matcher = { name: 'team', value: `(?i)${pattern}`, isRegex: true, isEqual: true };
  const encodedLength = encodeURIComponent(encodeMatcher(matcherToMatcherField(matcher))).length;
  return encodedLength <= MAX_SERVER_TEAM_FILTER_LENGTH
    ? { matchers: [matcher] }
    : { matchers: [], clientTeamPattern: pattern };
}

/**
 * How to filter for the current dropdown selection:
 * an explicit "All" pick means no filter at all, a picked label wins next,
 * and with no selection we fall back to the user's own teams when they have any.
 */
function resolveAlertFilter(scope: FilterScope, userTeamNames: string[]): AlertFilter {
  switch (scope.kind) {
    case 'all':
      return { matchers: [] };
    case 'label':
      // Picks are labels set on real rules, so they're matched exactly.
      return { matchers: [{ name: scope.label.key, value: scope.label.value, isRegex: false, isEqual: true }] };
    case 'default':
      // The `team` alert label is free-form — typically some slugged or re-cased variant
      // of the Grafana team name — so the own-teams default matches tolerantly.
      return buildTolerantTeamFilter(userTeamNames);
  }
}

export type FiringAlertsData = ReturnType<typeof useFiringAlerts>;

/**
 * All data fetching and derived state for the homepage Firing alerts view.
 *
 * When `selectedFilter` names a label (from the filter dropdown) it overrides the default
 * filter of the user's own teams.
 */
export function useFiringAlerts(selectedFilter: FilterSelection = '') {
  // The hook gates its own fetching so it's safe to call unconditionally, e.g. from the tabs component
  // when only incidents are available. Alert instances (/api/alertmanager) and user teams (/api/user/teams)
  // have no /apis equivalent yet, so on a multi-tenant stack the view has nothing to show and is hidden
  // like a missing plugin.
  const multiTenant = useFlagGrafanaMultiTenantHomepage();
  const enabled = !multiTenant && contextSrv.hasPermission(AccessControlAction.AlertingInstanceRead);

  // Fetched once — teams change at login granularity. A failed fetch toasts like any other API error and
  // leaves teams undefined, so the view falls back to all org alerts unfiltered.
  const shouldLoadTeams = enabled && contextSrv.isSignedIn;

  const { value: teams, loading: teamsLoading } = useAsync(async (): Promise<Team[]> => {
    if (!shouldLoadTeams) {
      return [];
    }
    const result = await getBackendSrv().get<Team[]>('/api/user/teams');
    // A proxy may answer 200 with an HTML page; don't let the row mapping crash on it.
    return Array.isArray(result) ? result : [];
  }, [shouldLoadTeams]);

  const teamNames = (teams ?? []).map((t) => t.name);
  const hasTeams = teamNames.length > 0;

  const filterScope = resolveFilterScope(selectedFilter);
  // No memo needed: RTK Query serializes query args, and the client pattern is a string compared by value.
  const { matchers, clientTeamPattern } = resolveAlertFilter(filterScope, teamNames);

  const {
    data: fetchedAlerts,
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

  const alerts = useMemo(() => {
    if (!fetchedAlerts || !clientTeamPattern) {
      return fetchedAlerts;
    }
    // `u` for the \p{...} classes and `i` for RE2's (?i); anchored like Alertmanager's regex matchers.
    const teamRegex = new RegExp(`^(?:${clientTeamPattern})$`, 'iu');
    return fetchedAlerts.filter((alert) => teamRegex.test(alert.labels.team ?? ''));
  }, [fetchedAlerts, clientTeamPattern]);

  // enabled && ... so the useAsync microtask tick doesn't report loading for gated users
  const loading = enabled && (teamsLoading || alertsLoading);

  // Severity and timestamp are derived once per alert so the sort comparator,
  // the header's severity counts, and the rows don't recompute them.
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
    // Cap the rendered rows; counts above are over every alert so the header pills stay accurate.
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
    teamsLoading: enabled && teamsLoading,
    // Echoed back so the card can scope its empty message to the picked label.
    filterScope,
    enabled,
    loading,
    error,
    refetch,
    canCreate,
    newRuleHref,
    viewAllHref,
  };
}

import { ALL_VARIABLE_VALUE } from 'app/features/variables/constants';

/**
 * A homepage team filter selection. The alerts and incidents views each keep their own,
 * because their option lists differ (alert label values vs. incident field values).
 * '' is the default scope ("your teams" for alerts, everything for incidents);
 * ALL_TEAMS is an explicit org-wide pick (alerts only); anything else is a team name.
 * A plain string so localStorage and the Combobox can hold it as-is.
 */
export type TeamSelection = string;

/** Sentinel for an explicit "All teams" pick; never a real team name. */
export const ALL_TEAMS = ALL_VARIABLE_VALUE;

export const ALERTS_TEAM_FILTER_STORAGE_KEY = 'grafana.home.alerts.teamFilter';
export const INCIDENTS_TEAM_FILTER_STORAGE_KEY = 'grafana.home.incidents.teamFilter';

export type TeamScope = { kind: 'default' } | { kind: 'all' } | { kind: 'team'; team: string };

export function resolveTeamScope(selection: TeamSelection): TeamScope {
  if (selection === ALL_TEAMS) {
    return { kind: 'all' };
  }
  if (selection) {
    return { kind: 'team', team: selection };
  }
  return { kind: 'default' };
}

/** The team the user explicitly picked, or undefined for the default and "All teams" scopes. */
export function explicitTeam(selection: TeamSelection): string | undefined {
  const scope = resolveTeamScope(selection);
  return scope.kind === 'team' ? scope.team : undefined;
}

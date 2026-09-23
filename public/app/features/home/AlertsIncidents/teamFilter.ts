import { ALL_VARIABLE_VALUE } from 'app/features/variables/constants';

/**
 * The homepage alerts team filter selection. '' is the default scope ("your teams" for
 * team members, everything otherwise); ALL_TEAMS is an explicit org-wide pick; anything
 * else is a team name. A plain string so localStorage and the Combobox can hold it as-is.
 * Incidents keep their own selection (IncidentFilterSelection) since their options differ.
 */
export type TeamSelection = string;

/** Sentinel for an explicit "All teams" pick; never a real team name. */
export const ALL_TEAMS = ALL_VARIABLE_VALUE;

export const ALERTS_TEAM_FILTER_STORAGE_KEY = 'grafana.home.alerts.teamFilter';
// Same string as when the filter was team-only, so stored selections survive the widening.
export const INCIDENTS_FILTER_STORAGE_KEY = 'grafana.home.incidents.teamFilter';

/**
 * The homepage incidents filter selection: '' for every active incident, otherwise
 * `slug:value` naming one select-field value (e.g. `team:Platform`, `squad:Frontend`).
 * A plain string so localStorage and the Combobox can hold it as-is.
 */
export type IncidentFilterSelection = string;

/** One custom-field value an incident filter selection names. */
export interface IncidentFilterValue {
  slug: string;
  value: string;
}

// Field slugs are identifiers, so the first ':' always separates slug from value.
const FILTER_SEPARATOR = ':';
const LEGACY_FILTER_SLUG = 'team';

export function encodeIncidentFilter({ slug, value }: IncidentFilterValue): IncidentFilterSelection {
  return `${slug}${FILTER_SEPARATOR}${value}`;
}

/** The field value the user picked, or undefined for the default (unfiltered) scope. */
export function decodeIncidentFilter(selection: IncidentFilterSelection): IncidentFilterValue | undefined {
  if (!selection) {
    return undefined;
  }
  const separatorIndex = selection.indexOf(FILTER_SEPARATOR);
  // A stored selection from before the filter carried a slug is a bare `team` value.
  if (separatorIndex <= 0) {
    return { slug: LEGACY_FILTER_SLUG, value: selection };
  }
  return { slug: selection.slice(0, separatorIndex), value: selection.slice(separatorIndex + 1) };
}

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

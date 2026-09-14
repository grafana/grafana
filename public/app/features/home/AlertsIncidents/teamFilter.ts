import { useCallback } from 'react';

import { useStoredString } from 'app/core/hooks/useStored';
import { ALL_VARIABLE_VALUE } from 'app/features/variables/constants';

/**
 * The homepage team filter, shared by the alerts and incidents views.
 * `undefined` is the default scope ("your teams" for alerts, everything for
 * incidents); ALL_TEAMS is an explicit org-wide pick; anything else is a team name.
 */
export type TeamSelection = string | undefined;

/** Sentinel for an explicit "All teams" pick; never a real team name. */
export const ALL_TEAMS = ALL_VARIABLE_VALUE;

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

// '' stands in for undefined where a plain string is required (localStorage, Combobox values).
export function encodeTeamSelection(selection: TeamSelection): string {
  return selection ?? '';
}

export function decodeTeamSelection(encoded: string): TeamSelection {
  return encoded || undefined;
}

export const TEAM_FILTER_STORAGE_KEY = 'grafana.home.teamFilter';

/** Persisted team selection shared by the alerts and incidents views and their header pills. */
export function useStoredTeamSelection(): [TeamSelection, (next: TeamSelection) => void] {
  const [stored, setStored] = useStoredString(TEAM_FILTER_STORAGE_KEY, '');
  const setSelection = useCallback((next: TeamSelection) => setStored(encodeTeamSelection(next)), [setStored]);
  return [decodeTeamSelection(stored), setSelection];
}

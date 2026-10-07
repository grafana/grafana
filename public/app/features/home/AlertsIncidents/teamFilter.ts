import { ALL_VARIABLE_VALUE } from 'app/features/variables/constants';

/** Sentinel for an explicit "All" pick; never a real option value. */
export const ALL_TEAMS = ALL_VARIABLE_VALUE;

type TeamScope = { kind: 'default' } | { kind: 'all' } | { kind: 'team'; team: string };

/**
 * The scope a homepage filter selection names: '' is the default ("your teams" for team members,
 * everything otherwise), ALL_TEAMS an explicit org-wide pick, and anything else a picked option.
 */
export function resolveTeamScope(selection: string): TeamScope {
  if (selection === ALL_TEAMS) {
    return { kind: 'all' };
  }
  if (selection) {
    return { kind: 'team', team: selection };
  }
  return { kind: 'default' };
}

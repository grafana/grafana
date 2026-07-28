import { useCallback, useMemo } from 'react';

import { t } from '@grafana/i18n';
import { Combobox, type ComboboxOption } from '@grafana/ui';
import { useLazySearchTeamsQuery, useSearchTeamsQuery, type SearchTeamsApiArg } from 'app/api/clients/legacy';

const DEFAULT_OPTION_VALUE = '';

const TEAMS_PAGE_SIZE = 100;

// Shared args builder so the eager query and the lazy searches hit the same
// RTK Query cache entries (`query: undefined` serializes identically to no query).
const searchTeamsArgs = (query?: string): SearchTeamsApiArg => ({
  query: query || undefined,
  perpage: TEAMS_PAGE_SIZE,
  sort: 'name-asc',
});

// Clearing the selection restores useFiringAlerts' default scope: the user's own
// teams when they belong to any, otherwise all org alerts. The label mirrors that
// branch so the option doesn't promise org-wide alerts it won't show.
const getDefaultOption = (userHasTeams: boolean): ComboboxOption<string> => ({
  label: userHasTeams
    ? t('home.alerts-incidents.team-filter-your-teams', 'Your teams')
    : t('home.alerts-incidents.team-filter-all', 'All teams'),
  value: DEFAULT_OPTION_VALUE,
});

interface Props {
  selectedTeam: string | undefined;
  onChange: (team: string | undefined) => void;
  /** Whether the signed-in user belongs to any teams; decides the default option's wording. */
  userHasTeams: boolean;
}

/**
 * Dropdown to filter the homepage firing alerts by team. Hidden while teams
 * load, on error, or when the org has no teams.
 *
 * Shows the first page of teams by default; typing searches server-side, so
 * teams beyond the first page are still reachable.
 */
export function TeamFilterCombobox({ selectedTeam, onChange, userHasTeams }: Props) {
  const { data, isLoading, error } = useSearchTeamsQuery(searchTeamsArgs());
  const [searchTeams] = useLazySearchTeamsQuery();

  // Async Combobox needs the full option (not just the value) to show a label.
  // Must be memoized: a new object every render makes downshift think the
  // selection changed, which wipes the input while the user is typing.
  const valueOption = useMemo(
    () => (selectedTeam ? { label: selectedTeam, value: selectedTeam } : getDefaultOption(userHasTeams)),
    [selectedTeam, userHasTeams]
  );

  const loadOptions = useCallback(
    async (inputValue: string): Promise<Array<ComboboxOption<string>>> => {
      // preferCacheValue: reopening with the same input reuses the cached page.
      const result = await searchTeams(searchTeamsArgs(inputValue), true).unwrap();
      const teamOptions = (result.teams ?? []).map((team) => ({ label: team.name, value: team.name }));
      // The default-scope sentinel only belongs on the unfiltered default list.
      return inputValue ? teamOptions : [getDefaultOption(userHasTeams), ...teamOptions];
    },
    [searchTeams, userHasTeams]
  );

  const teams = data?.teams ?? [];
  if (isLoading || error || teams.length === 0) {
    return null;
  }

  return (
    <Combobox
      width="auto"
      minWidth={20}
      options={loadOptions}
      value={valueOption}
      onChange={(option) => {
        const newTeam = option.value === DEFAULT_OPTION_VALUE ? undefined : option.value;
        // Re-selecting the current value is a no-op so the parent doesn't re-render.
        if (newTeam !== selectedTeam) {
          onChange(newTeam);
        }
      }}
      aria-label={t('home.alerts-incidents.team-filter-label', 'Filter alerts by team')}
    />
  );
}

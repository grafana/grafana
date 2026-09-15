import { useCallback, useMemo } from 'react';

import { t } from '@grafana/i18n';
import { Combobox, type ComboboxOption } from '@grafana/ui';

import { ALL_TEAMS, type TeamSelection, resolveTeamScope } from './teamFilter';

const collator = new Intl.Collator();

// '' is the default scope of TeamSelection, so the option value is the selection itself.
const getYourTeamsOption = (): ComboboxOption<TeamSelection> => ({
  label: t('home.alerts-incidents.team-filter-your-teams', 'Your teams'),
  value: '',
});

const getAllTeamsOption = (value: TeamSelection): ComboboxOption<TeamSelection> => ({
  label: t('home.alerts-incidents.team-filter-all', 'All teams'),
  value,
});

interface Props {
  /** Options to offer; undefined while loading or on error, which hides the dropdown. */
  teamValues: string[] | undefined;
  selectedTeam: TeamSelection;
  onChange: (team: TeamSelection) => void;
  /** Whether the signed-in user belongs to any Grafana teams. */
  userHasTeams: boolean;
  /**
   * Whether this view can scope to the user's own teams (alerts can, incidents can't).
   * With it, team members get a "Your teams" default plus an explicit "All teams" escape hatch.
   */
  hasOwnTeamsScope: boolean;
  ariaLabel: string;
}

/**
 * Dropdown to filter a homepage view by team. Presentational: the caller supplies
 * the option values (alert label values or incident field values), so both tabs can
 * share one selection while offering their own option lists.
 */
export function TeamFilterCombobox({
  teamValues,
  selectedTeam,
  onChange,
  userHasTeams,
  hasOwnTeamsScope,
  ariaLabel,
}: Props) {
  // Single sort site for both tabs, so neither data hook has to.
  const sortedValues = useMemo(() => [...(teamValues ?? [])].sort((a, b) => collator.compare(a, b)), [teamValues]);

  const offersYourTeams = hasOwnTeamsScope && userHasTeams;
  // For team members "All teams" must write the sentinel on every tab: the default scope
  // means "your teams" on alerts, so writing '' here would silently re-scope that tab.
  // Users without teams have no "your teams" scope anywhere, so '' already means all.
  const allTeamsValue: TeamSelection = userHasTeams ? ALL_TEAMS : '';

  // Async Combobox needs the full option (not just the value) to show a label.
  // Must be memoized: a new object every render makes downshift think the
  // selection changed, which wipes the input while the user is typing.
  const valueOption = useMemo(() => {
    const scope = resolveTeamScope(selectedTeam);
    switch (scope.kind) {
      case 'all':
        return getAllTeamsOption(allTeamsValue);
      case 'team':
        return { label: scope.team, value: scope.team };
      case 'default':
        // Without a "your teams" scope the default already means "All teams", so show that.
        return offersYourTeams ? getYourTeamsOption() : getAllTeamsOption(allTeamsValue);
    }
  }, [selectedTeam, offersYourTeams, allTeamsValue]);

  const loadOptions = useCallback(
    async (inputValue: string): Promise<Array<ComboboxOption<TeamSelection>>> => {
      const query = inputValue.toLowerCase();
      const teamOptions = sortedValues
        .filter((team) => team.toLowerCase().includes(query))
        .map((team) => ({ label: team, value: team }));
      // The scope options only belong on the unfiltered default list.
      const scopeOptions = offersYourTeams
        ? [getYourTeamsOption(), getAllTeamsOption(allTeamsValue)]
        : [getAllTeamsOption(allTeamsValue)];
      return inputValue ? teamOptions : [...scopeOptions, ...teamOptions];
    },
    [sortedValues, offersYourTeams, allTeamsValue]
  );

  if (sortedValues.length === 0) {
    return null;
  }

  return (
    <Combobox
      width="auto"
      minWidth={20}
      options={loadOptions}
      value={valueOption}
      onChange={(option) => {
        // Compare against what's displayed, not the raw selection: re-picking the shown option
        // is a no-op even when it stands in for a different underlying value (see valueOption).
        if (option.value !== valueOption.value) {
          onChange(option.value);
        }
      }}
      aria-label={ariaLabel}
    />
  );
}

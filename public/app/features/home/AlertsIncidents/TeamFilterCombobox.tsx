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
  /**
   * Whether the default scope is the user's own teams (alerts, for team members). Adds a
   * "Your teams" default plus an explicit "All teams" escape hatch; otherwise the default
   * option already means "All teams".
   */
  offersYourTeams: boolean;
  ariaLabel: string;
}

/**
 * Dropdown to filter a homepage view by team. Presentational: the caller supplies
 * the option values (alert label values or incident field values) and owns the selection.
 */
export function TeamFilterCombobox({ teamValues, selectedTeam, onChange, offersYourTeams, ariaLabel }: Props) {
  // Single sort site for both tabs, so neither data hook has to.
  const sortedValues = useMemo(() => [...(teamValues ?? [])].sort((a, b) => collator.compare(a, b)), [teamValues]);

  // Only a "your teams" default needs a distinct sentinel for org-wide; otherwise '' already means all.
  const allTeamsValue: TeamSelection = offersYourTeams ? ALL_TEAMS : '';

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
        // Re-selecting the current value is a no-op so the parent doesn't re-render.
        if (option.value !== selectedTeam) {
          onChange(option.value);
        }
      }}
      aria-label={ariaLabel}
    />
  );
}

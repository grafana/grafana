import { useCallback, useMemo } from 'react';

import { t } from '@grafana/i18n';
import { Combobox, type ComboboxOption } from '@grafana/ui';

import { ALL_TEAMS, type TeamSelection, resolveTeamScope } from './teamFilter';

const collator = new Intl.Collator();

// '' is the default scope of TeamSelection, so the option value is the selection itself.
const getDefaultOption = (userHasTeams: boolean): ComboboxOption<TeamSelection> => ({
  label: userHasTeams
    ? t('home.alerts-incidents.team-filter-your-teams', 'Your teams')
    : t('home.alerts-incidents.team-filter-all', 'All teams'),
  value: '',
});

// Explicit org-wide scope for users who do belong to teams; without it they'd have
// no way back to unfiltered alerts. Users without teams don't need it — their
// default option already reads "All teams".
const getAllTeamsOption = (): ComboboxOption<TeamSelection> => ({
  label: t('home.alerts-incidents.team-filter-all', 'All teams'),
  value: ALL_TEAMS,
});

interface Props {
  /** Options to offer; undefined while loading or on error, which hides the dropdown. */
  teamValues: string[] | undefined;
  selectedTeam: TeamSelection;
  onChange: (team: TeamSelection) => void;
  /**
   * Whether the default (unselected) scope is the user's own teams. Decides the default
   * option's wording and whether the explicit "All teams" escape hatch is offered.
   */
  userHasTeams: boolean;
  ariaLabel: string;
}

/**
 * Dropdown to filter a homepage view by team. Presentational: the caller supplies
 * the option values (alert label values or incident field values), so both tabs can
 * share one selection while offering their own option lists.
 */
export function TeamFilterCombobox({ teamValues, selectedTeam, onChange, userHasTeams, ariaLabel }: Props) {
  // Single sort site for both tabs, so neither data hook has to.
  const sortedValues = useMemo(() => [...(teamValues ?? [])].sort((a, b) => collator.compare(a, b)), [teamValues]);
  // Async Combobox needs the full option (not just the value) to show a label.
  // Must be memoized: a new object every render makes downshift think the
  // selection changed, which wipes the input while the user is typing.
  const valueOption = useMemo(() => {
    const scope = resolveTeamScope(selectedTeam);
    switch (scope.kind) {
      case 'all':
        // Render the label, never the raw sentinel. Without a "your teams" scope the
        // default option already means "All teams", so highlight that one.
        return userHasTeams ? getAllTeamsOption() : getDefaultOption(false);
      case 'team':
        return { label: scope.team, value: scope.team };
      case 'default':
        return getDefaultOption(userHasTeams);
    }
  }, [selectedTeam, userHasTeams]);

  const loadOptions = useCallback(
    async (inputValue: string): Promise<Array<ComboboxOption<TeamSelection>>> => {
      const query = inputValue.toLowerCase();
      const teamOptions = sortedValues
        .filter((team) => team.toLowerCase().includes(query))
        .map((team) => ({ label: team, value: team }));
      // The scope sentinels only belong on the unfiltered default list. "All teams"
      // is added only for team members — otherwise the default option already says it.
      return inputValue
        ? teamOptions
        : [getDefaultOption(userHasTeams), ...(userHasTeams ? [getAllTeamsOption()] : []), ...teamOptions];
    },
    [sortedValues, userHasTeams]
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

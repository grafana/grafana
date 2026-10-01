import { useCallback, useMemo } from 'react';

import { t } from '@grafana/i18n';
import { Combobox, type ComboboxOption } from '@grafana/ui';

import { ALL_TEAMS, resolveTeamScope } from './teamFilter';

const collator = new Intl.Collator();

// '' is the default scope of every selection, so the option value is the selection itself.
const getYourTeamsOption = (): ComboboxOption<string> => ({
  label: t('home.alerts-incidents.team-filter-your-teams', 'Your teams'),
  value: '',
});

const getAllOption = (label: string, value: string): ComboboxOption<string> => ({ label, value });

// Single sort site for both tabs, so neither data hook has to. Grouped options stay
// together under their header; ungrouped ones sort ahead of them.
function sortOptions(options: Array<ComboboxOption<string>>): Array<ComboboxOption<string>> {
  const sorted = [...options].sort(
    (a, b) => collator.compare(a.group ?? '', b.group ?? '') || collator.compare(a.label ?? '', b.label ?? '')
  );
  // A lone header is noise: most orgs only have `team`, so headers only appear with several groups.
  const singleGroup = new Set(sorted.map((option) => option.group)).size <= 1;
  return singleGroup ? sorted.map(({ group, ...option }) => option) : sorted;
}

interface Props {
  /**
   * Options to offer, each with `group` set to render a header above the options sharing it.
   * The caller hides the dropdown when there are none.
   */
  options: Array<ComboboxOption<string>>;
  /** '' is the default scope, ALL_TEAMS the org-wide pick, anything else an option value. */
  selected: string;
  onChange: (selection: string) => void;
  /**
   * Whether the default scope is the user's own teams (alerts, for team members). Adds a
   * "Your teams" default plus an explicit escape hatch to everything; otherwise the default
   * option already means everything.
   */
  offersYourTeams: boolean;
  /** Label of the unfiltered option, e.g. "All teams" or "All incidents". */
  allOptionLabel: string;
  /**
   * How to display a picked option value when it isn't its own label: alerts store the
   * team name itself, incidents store an encoded `slug:value`.
   */
  selectionLabel?: (selection: string) => string;
  ariaLabel: string;
}

/**
 * Dropdown to filter a homepage view. Presentational: the caller supplies the options
 * (alert team label values or incident label values) and owns the selection.
 */
export function TeamFilterCombobox({
  options,
  selected,
  onChange,
  offersYourTeams,
  allOptionLabel,
  selectionLabel,
  ariaLabel,
}: Props) {
  const sortedOptions = useMemo(() => sortOptions(options), [options]);

  // Only a "your teams" default needs a distinct sentinel for org-wide; otherwise '' already means all.
  const allOption = useMemo(
    () => getAllOption(allOptionLabel, offersYourTeams ? ALL_TEAMS : ''),
    [allOptionLabel, offersYourTeams]
  );

  // Async Combobox needs the full option (not just the value) to show a label.
  // Must be memoized: a new object every render makes downshift think the
  // selection changed, which wipes the input while the user is typing.
  const valueOption = useMemo(() => {
    const scope = resolveTeamScope(selected);
    switch (scope.kind) {
      case 'all':
        return allOption;
      case 'team':
        // Built from the selection alone, so a pick whose option is gone (e.g. archived) still shows.
        return { label: selectionLabel?.(scope.team) ?? scope.team, value: scope.team };
      case 'default':
        // Without a "your teams" scope the default already means everything, so show that.
        return offersYourTeams ? getYourTeamsOption() : allOption;
    }
  }, [selected, offersYourTeams, allOption, selectionLabel]);

  const loadOptions = useCallback(
    async (inputValue: string): Promise<Array<ComboboxOption<string>>> => {
      const query = inputValue.toLowerCase();
      // Typing a field name (the group header) lists everything under it.
      const matching = sortedOptions.filter(
        (option) => option.label?.toLowerCase().includes(query) || option.group?.toLowerCase().includes(query)
      );
      // The scope options only belong on the unfiltered default list.
      const scopeOptions = offersYourTeams ? [getYourTeamsOption(), allOption] : [allOption];
      return inputValue ? matching : [...scopeOptions, ...matching];
    },
    [sortedOptions, offersYourTeams, allOption]
  );

  return (
    <Combobox
      width="auto"
      minWidth={20}
      maxWidth={24}
      prefixIcon="users-alt"
      options={loadOptions}
      value={valueOption}
      onChange={(option) => {
        // Re-selecting the current value is a no-op so the parent doesn't re-render.
        if (option.value !== selected) {
          onChange(option.value);
        }
      }}
      aria-label={ariaLabel}
    />
  );
}

import { useCallback, useMemo } from 'react';

import { t } from '@grafana/i18n';
import { Combobox, type ComboboxOption } from '@grafana/ui';

import { ALL_TEAMS, resolveTeamScope } from './teamFilter';

const collator = new Intl.Collator();

/** A pickable value; `group` renders as a header above the options sharing it. */
export interface FilterOption {
  label: string;
  value: string;
  group?: string;
}

// '' is the default scope of every selection, so the option value is the selection itself.
const getYourTeamsOption = (): ComboboxOption<string> => ({
  label: t('home.alerts-incidents.team-filter-your-teams', 'Your teams'),
  value: '',
});

const getAllOption = (label: string, value: string): ComboboxOption<string> => ({ label, value });

interface Props {
  /** Options to offer; the caller hides the dropdown when there are none. */
  options: FilterOption[];
  /** Opaque to this component: '' is the default scope, ALL_TEAMS the org-wide pick, anything else an option value. */
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
   * Display label for a stored selection that none of the options carry anymore (e.g. its
   * field was archived). Only needed when the selection isn't already the display label:
   * alerts store the team name itself, incidents store an encoded `slug:value`.
   */
  formatStaleSelection?: (selection: string) => string;
  ariaLabel: string;
}

/**
 * Dropdown to filter a homepage view. Presentational: the caller supplies the options
 * (alert team label values or incident custom-field values) and owns the selection.
 */
export function FilterCombobox({
  options,
  selected,
  onChange,
  offersYourTeams,
  allOptionLabel,
  formatStaleSelection,
  ariaLabel,
}: Props) {
  // Single sort site for both tabs, so neither data hook has to. Grouped options stay
  // together under their header; ungrouped ones sort ahead of them.
  const sortedOptions = useMemo(
    () =>
      [...options].sort((a, b) => collator.compare(a.group ?? '', b.group ?? '') || collator.compare(a.label, b.label)),
    [options]
  );

  // Only a "your teams" default needs a distinct sentinel for org-wide; otherwise '' already means all.
  const allValue = offersYourTeams ? ALL_TEAMS : '';

  // Async Combobox needs the full option (not just the value) to show a label.
  // Must be memoized: a new object every render makes downshift think the
  // selection changed, which wipes the input while the user is typing.
  const valueOption = useMemo(() => {
    const scope = resolveTeamScope(selected);
    switch (scope.kind) {
      case 'all':
        return getAllOption(allOptionLabel, allValue);
      case 'team':
        // A stored selection may name a value no longer offered; still show it rather than blank.
        return (
          sortedOptions.find((option) => option.value === selected) ?? {
            label: formatStaleSelection?.(scope.team) ?? scope.team,
            value: scope.team,
          }
        );
      case 'default':
        // Without a "your teams" scope the default already means everything, so show that.
        return offersYourTeams ? getYourTeamsOption() : getAllOption(allOptionLabel, allValue);
    }
  }, [selected, offersYourTeams, allOptionLabel, allValue, sortedOptions, formatStaleSelection]);

  const loadOptions = useCallback(
    async (inputValue: string): Promise<Array<ComboboxOption<string>>> => {
      const query = inputValue.toLowerCase();
      // Typing a field name (the group header) lists everything under it.
      const matching = sortedOptions.filter(
        (option) => option.label.toLowerCase().includes(query) || option.group?.toLowerCase().includes(query)
      );
      // The scope options only belong on the unfiltered default list.
      const scopeOptions = offersYourTeams
        ? [getYourTeamsOption(), getAllOption(allOptionLabel, allValue)]
        : [getAllOption(allOptionLabel, allValue)];
      return inputValue ? matching : [...scopeOptions, ...matching];
    },
    [sortedOptions, offersYourTeams, allOptionLabel, allValue]
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

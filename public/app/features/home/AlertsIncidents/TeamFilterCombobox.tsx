import { useCallback, useMemo } from 'react';
import { useAsync } from 'react-use';

import { getDefaultTimeRange } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Combobox, type ComboboxOption } from '@grafana/ui';
import { fetchTagValues } from 'app/features/alerting/unified/triage/scene/tagKeysProviders';
import { ALL_VARIABLE_VALUE } from 'app/features/variables/constants';

const DEFAULT_OPTION_VALUE = '';

const collator = new Intl.Collator();

// Clearing the selection restores useFiringAlerts' default scope: the user's own
// teams when they belong to any, otherwise all org alerts. The label mirrors that
// branch so the option doesn't promise org-wide alerts it won't show.
const getDefaultOption = (userHasTeams: boolean): ComboboxOption<string> => ({
  label: userHasTeams
    ? t('home.alerts-incidents.team-filter-your-teams', 'Your teams')
    : t('home.alerts-incidents.team-filter-all', 'All teams'),
  value: DEFAULT_OPTION_VALUE,
});

// Explicit org-wide scope for users who do belong to teams; without it they'd have
// no way back to unfiltered alerts. Users without teams don't need it — their
// default option already reads "All teams".
const getAllTeamsOption = (): ComboboxOption<string> => ({
  label: t('home.alerts-incidents.team-filter-all', 'All teams'),
  value: ALL_VARIABLE_VALUE,
});

interface Props {
  selectedTeam: string | undefined;
  onChange: (team: string | undefined) => void;
  /** Whether the signed-in user belongs to any teams; decides the default option's wording. */
  userHasTeams: boolean;
}

/**
 * Dropdown to filter the homepage firing alerts by team. The options are the
 * `team` label values seen on alerts (from the state-history Prometheus
 * datasource), not Grafana org teams — that's what the alertmanager matcher
 * actually filters on. Hidden while values load, on error, when no alert
 * carries a team label, or when the state-history datasource isn't configured.
 */
export function TeamFilterCombobox({ selectedTeam, onChange, userHasTeams }: Props) {
  // Read at render time (not module scope) so tests can vary the config.
  const datasourceConfigured = Boolean(config.unifiedAlerting.stateHistory?.prometheusTargetDatasourceUID);

  // Fetched once per mount; the label-value set changes slowly enough that
  // client-side filtering over it covers the search box.
  const {
    value: teamValues,
    loading,
    error,
  } = useAsync(async () => {
    if (!datasourceConfigured) {
      return [];
    }
    const values = await fetchTagValues(getDefaultTimeRange(), 'team');
    return values.map((v) => String(v.value ?? v.text)).sort((a, b) => collator.compare(a, b));
  }, [datasourceConfigured]);

  // Async Combobox needs the full option (not just the value) to show a label.
  // Must be memoized: a new object every render makes downshift think the
  // selection changed, which wipes the input while the user is typing.
  const valueOption = useMemo(() => {
    if (selectedTeam === ALL_VARIABLE_VALUE) {
      // Render the label, never the raw sentinel.
      return getAllTeamsOption();
    }
    return selectedTeam ? { label: selectedTeam, value: selectedTeam } : getDefaultOption(userHasTeams);
  }, [selectedTeam, userHasTeams]);

  const loadOptions = useCallback(
    async (inputValue: string): Promise<Array<ComboboxOption<string>>> => {
      const query = inputValue.toLowerCase();
      const teamOptions = (teamValues ?? [])
        .filter((team) => team.toLowerCase().includes(query))
        .map((team) => ({ label: team, value: team }));
      // The scope sentinels only belong on the unfiltered default list. "All teams"
      // is added only for team members — otherwise the default option already says it.
      return inputValue
        ? teamOptions
        : [getDefaultOption(userHasTeams), ...(userHasTeams ? [getAllTeamsOption()] : []), ...teamOptions];
    },
    [teamValues, userHasTeams]
  );

  if (!datasourceConfigured || loading || error || !teamValues || teamValues.length === 0) {
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

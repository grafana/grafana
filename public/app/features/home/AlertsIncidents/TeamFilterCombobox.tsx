import { useMemo } from 'react';

import { t } from '@grafana/i18n';
import { Combobox, type ComboboxOption } from '@grafana/ui';
import { alertmanagerApi } from 'app/features/alerting/unified/api/alertmanagerApi';
import { type AlertmanagerAlert } from 'app/plugins/datasource/alertmanager/types';

import { firingAlertsQueryArgs } from './useFiringAlerts';

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

/** One option per distinct `team` label across the given alerts, sorted by name. */
function getTeamOptions(alerts: AlertmanagerAlert[]): Array<ComboboxOption<string>> {
  const teamNames = new Set(alerts.map((alert) => alert.labels.team).filter(Boolean));
  return [...teamNames].sort(collator.compare).map((name) => ({ label: name, value: name }));
}

interface Props {
  selectedTeam: string | undefined;
  onChange: (team: string | undefined) => void;
  /** Whether the signed-in user belongs to any teams; decides the default option's wording. */
  userHasTeams: boolean;
}

/**
 * Dropdown to filter the homepage firing alerts by their `team` label. Hidden
 * while alerts load, on error, or when no firing alert carries a team label.
 *
 * Options are derived from the org's firing alerts rather than the teams API:
 * /api/teams/search only returns teams the user has teams:read on (typically
 * just their own), which would defeat covering another team. The alerts query
 * is gated by the same permission as the card itself, so anyone who can see
 * the card can see every filterable team.
 */
export function TeamFilterCombobox({ selectedTeam, onChange, userHasTeams }: Props) {
  // No matchers: the org-wide alert set names every team that can be filtered on.
  const { data: alerts, isLoading, error } = alertmanagerApi.useGetAlertmanagerAlertsQuery(firingAlertsQueryArgs([]));

  const options = useMemo(
    () => [getDefaultOption(userHasTeams), ...getTeamOptions(alerts ?? [])],
    [alerts, userHasTeams]
  );

  // The selected team can drop out of the options when its alerts resolve, so pass
  // the full option (not just the value) to keep its label on the closed input.
  // Must be memoized: a new object every render makes downshift think the
  // selection changed, which wipes the input while the user is typing.
  const valueOption = useMemo(
    () => (selectedTeam ? { label: selectedTeam, value: selectedTeam } : getDefaultOption(userHasTeams)),
    [selectedTeam, userHasTeams]
  );

  // options always contains the default sentinel, so > 1 means real team labels exist.
  if (isLoading || error || options.length <= 1) {
    return null;
  }

  return (
    <Combobox
      width="auto"
      minWidth={20}
      options={options}
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

import { css } from '@emotion/css';
import { useMemo } from 'react';

import { type GrafanaTheme2, type SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Icon, MultiSelect, useStyles2 } from '@grafana/ui';
import { useSearchTeamsQuery } from 'app/api/clients/legacy';
import { teamOwnerRef } from 'app/features/browse-dashboards/utils/dashboards';

const ALL_TEAMS_VALUE = '__all-teams__';

interface OwnersFilterProps {
  values: string[];
  onChange: (ownerReference: string[]) => void;
}

/**
 * A filter component that allows selecting multiple existing teams.
 */
export function OwnersFilter({ values, onChange }: OwnersFilterProps) {
  const styles = useStyles2(getStyles);
  // At this point we have hard limit for number of items we show. The issue is we are using MultiSelect because of
  // some UX bug (it opens only when clicking on internal input, not the full element) in Combobox but Multiselect
  // then does not allow for async options loading.
  const { data, isLoading } = useSearchTeamsQuery({ perpage: 200, sort: 'name-asc' });

  const teamOptions = useMemo<Array<SelectableValue<string>>>(() => {
    if (!data?.teams) {
      return [];
    }
    return data.teams.map((team) => ({
      label: team.name,
      value: teamOwnerRef(team),
      imgUrl: team.avatarUrl,
    }));
  }, [data?.teams]);

  const allTeamsValue = useMemo(() => {
    return {
      label: t('browse-dashboards.filters.all-teams', 'All teams'),
      value: ALL_TEAMS_VALUE,
    };
  }, []);

  // We go through some hoops here to create a virtual "all teams" item to allow quickly selecting all the teams
  // in the select.
  const allTeamReferences = useMemo(() => {
    // option.value is UID of the team. This needs to exist always so we should be able to use ! here.
    return teamOptions.map((option) => option.value!);
  }, [teamOptions]);

  // Check if the value prop matches list of all the teams we get from the API
  const hasAllTeamsSelected =
    values.length > 0 &&
    allTeamReferences.length > 0 &&
    values.length === allTeamReferences.length &&
    allTeamReferences.every((reference) => values.includes(reference));

  const value = hasAllTeamsSelected
    ? [allTeamsValue]
    : teamOptions.filter((option) => option.value && values.includes(option.value));

  // Add "all teams" option if there are some actual teams
  const options = useMemo<Array<SelectableValue<string>>>(() => {
    if (teamOptions.length === 0) {
      return [];
    }
    return [allTeamsValue, ...teamOptions];
  }, [teamOptions, allTeamsValue]);

  return (
    <div className={styles.ownerFilter}>
      <MultiSelect<string>
        aria-label={t('browse-dashboards.filters.owner-aria-label', 'Owner filter')}
        options={options}
        value={value}
        onChange={(selectedOptions) => {
          const values = selectedOptions.map((option) => option.value!);
          // We don't send ALL_TEAMS_VALUE upstream, so we map it to actual list of all the teams.
          onChange(values.includes(ALL_TEAMS_VALUE) ? allTeamReferences : values);
        }}
        noOptionsMessage={t('browse-dashboards.filters.owner-no-options', 'No teams found')}
        loadingMessage={t('browse-dashboards.filters.owner-loading', 'Loading teams...')}
        placeholder={t('browse-dashboards.filters.owner-placeholder', 'Filter by owner')}
        isLoading={isLoading}
        prefix={<Icon name="filter" />}
      />
    </div>
  );
}

const getStyles = (_theme: GrafanaTheme2) => ({
  ownerFilter: css({
    minWidth: '180px',
    flexGrow: 1,
  }),
});

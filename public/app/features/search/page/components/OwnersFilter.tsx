import { css } from '@emotion/css';
import { useMemo } from 'react';

import { type GrafanaTheme2, type SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Icon, MultiSelect, Tooltip, useStyles2 } from '@grafana/ui';
import { useSearchTeamsQuery } from 'app/api/clients/legacy';
import { extractErrorMessage } from 'app/api/utils';
import { teamOwnerRef } from 'app/features/browse-dashboards/utils/dashboards';

const ALL_TEAMS_VALUE = '__all-teams__';
// The number here is currently arbitrary, feel free to change if it makes sense.
const TEAM_OPTIONS_LIMIT = 200;

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
  // UX bug https://github.com/grafana/grafana/issues/121586 in Combobox but Multiselect
  // then does not allow for async options loading.
  const { data, error, isLoading } = useSearchTeamsQuery({ perpage: TEAM_OPTIONS_LIMIT, sort: 'name-asc' });

  // In this case we show a warning tooltip and don't show the allTeamsValue as we cannot really select *all* the teams
  // if we cannot load them.
  const hasMoreTeamsThanLimit = (data?.totalCount ?? 0) > TEAM_OPTIONS_LIMIT;
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
    return (
      teamOptions
        .map((option) => option.value)
        // option.value is UID of the team so should always exist but this helps with typing.
        .filter((value) => value !== undefined)
    );
  }, [teamOptions]);

  // Check if the value prop matches list of all the teams we get from the API
  const hasAllTeamsSelected =
    !hasMoreTeamsThanLimit &&
    values.length > 0 &&
    allTeamReferences.length > 0 &&
    values.length === allTeamReferences.length &&
    allTeamReferences.every((reference) => values.includes(reference));

  const value = useMemo(() => {
    return hasAllTeamsSelected
      ? [allTeamsValue]
      : teamOptions.filter((option) => option.value && values.includes(option.value));
  }, [hasAllTeamsSelected, allTeamsValue, teamOptions, values]);

  // Add "all teams" option if there are some actual teams
  const options = useMemo<Array<SelectableValue<string>>>(() => {
    if (teamOptions.length === 0) {
      return [];
    }

    if (hasMoreTeamsThanLimit) {
      return teamOptions;
    }

    return [allTeamsValue, ...teamOptions];
  }, [allTeamsValue, hasMoreTeamsThanLimit, teamOptions]);

  return (
    <div className={styles.ownerFilter}>
      <MultiSelect<string>
        aria-label={t('browse-dashboards.filters.owner-aria-label', 'Owner filter')}
        options={options}
        value={value}
        onChange={(selectedOptions) => {
          const values = selectedOptions.map((option) => option.value).filter((value) => value !== undefined);
          // We don't send ALL_TEAMS_VALUE upstream, so we map it to actual list of all the teams.
          onChange(!hasMoreTeamsThanLimit && values.includes(ALL_TEAMS_VALUE) ? allTeamReferences : values);
        }}
        noOptionsMessage={t('browse-dashboards.filters.owner-no-options', 'No teams found')}
        loadingMessage={t('browse-dashboards.filters.owner-loading', 'Loading teams...')}
        placeholder={t('browse-dashboards.filters.owner-placeholder', 'Filter by owner')}
        isLoading={isLoading}
        prefix={
          error ? (
            <LoadErrorTooltip error={error} />
          ) : hasMoreTeamsThanLimit ? (
            <TruncatedListTooltip totalCount={data?.totalCount} />
          ) : (
            <Icon name="filter" />
          )
        }
      />
    </div>
  );
}

function TruncatedListTooltip({ totalCount }: { totalCount: number | undefined }) {
  const styles = useStyles2(getStyles);
  return (
    <Tooltip
      content={t(
        'browse-dashboards.filters.owner-limit-warning',
        'Listing only first {{limit}} teams out of {{totalCount}}.',
        { limit: TEAM_OPTIONS_LIMIT, totalCount: totalCount ?? 0 }
      )}
      placement="top"
    >
      <span
        aria-label={t('browse-dashboards.filters.owner-limit-warning-icon', 'Owner filter limit warning')}
        className={styles.warningIcon}
      >
        <Icon name="exclamation-triangle" size="sm" />
      </span>
    </Tooltip>
  );
}

function LoadErrorTooltip({ error }: { error: unknown }) {
  const styles = useStyles2(getStyles);

  const errorMessage =
    t('browse-dashboards.filters.owner-load-error-prefix', 'Failed to load teams because of error:') +
    ' ' +
    extractErrorMessage(error);

  return (
    <Tooltip content={errorMessage} placement="top">
      <span
        aria-label={t('browse-dashboards.filters.owner-load-error-icon', 'Owner filter load error')}
        className={styles.errorIcon}
      >
        <Icon name="exclamation-circle" size="sm" />
      </span>
    </Tooltip>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  ownerFilter: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    minWidth: '180px',
    flexGrow: 1,
  }),
  warningIcon: css({
    display: 'inline-flex',
    alignItems: 'center',
    color: theme.colors.warning.text,
    cursor: 'help',
  }),
  errorIcon: css({
    display: 'inline-flex',
    alignItems: 'center',
    color: theme.colors.error.text,
    cursor: 'help',
  }),
});

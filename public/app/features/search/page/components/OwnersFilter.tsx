import { css } from '@emotion/css';
import { QueryStatus } from '@reduxjs/toolkit/query';
import debounce from 'debounce-promise';
import { useEffect, useMemo, useRef, useState } from 'react';

import { type GrafanaTheme2, type SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { AsyncMultiSelect, Icon, Tooltip, useStyles2 } from '@grafana/ui';
import { extractErrorMessage } from 'app/api/utils';
import { parseOwnerRef, teamOwnerRef } from 'app/features/browse-dashboards/utils/dashboards';
import { useLazyGetTeamByUidQuery, useLazySearchTeamsQuery } from 'app/features/teams/hooks';
import { getTeamGravatarUrl } from 'app/features/teams/utils';

const SEARCH_DEBOUNCE_MS = 300;

interface OwnersFilterProps {
  values: string[];
  onChange: (ownerReference: string[]) => void;
}

interface TeamDisplay {
  label: string;
  imgUrl?: string;
}

/**
 * A filter component that allows selecting multiple existing teams, searched asynchronously.
 */
export function OwnersFilter({ values, onChange }: OwnersFilterProps) {
  const styles = useStyles2(getStyles);
  const [searchTeams, { error, isFetching }] = useLazySearchTeamsQuery();
  const [getTeam] = useLazyGetTeamByUidQuery();

  // Display details by team UID, collected from search responses and by-UID lookups, so selected
  // owner references (e.g. restored from the URL) can be shown with the team name and avatar.
  const [teamByUid, setTeamByUid] = useState<Record<string, TeamDisplay>>({});
  const requestedUids = useRef(new Set<string>());

  const loadOptions = useMemo(
    () =>
      debounce(
        async (query: string): Promise<Array<SelectableValue<string>>> => {
          const { data } = await searchTeams({ query }, true);
          const teams = await Promise.all(
            (data?.hits ?? []).map(async (hit: { name: string; title: string; email?: string }) => ({
              uid: hit.name,
              display: { label: hit.title, imgUrl: await getTeamGravatarUrl(hit.email ?? '', hit.title) },
            }))
          );
          setTeamByUid((prev) => ({
            ...prev,
            ...Object.fromEntries(teams.map((team) => [team.uid, team.display])),
          }));
          return teams.map((team) => ({
            label: team.display.label,
            value: teamOwnerRef({ uid: team.uid }),
            imgUrl: team.display.imgUrl,
          }));
        },
        SEARCH_DEBOUNCE_MS,
        { leading: true }
      ),
    [searchTeams]
  );

  // Resolve display details for selected owner references that haven't been seen in any search
  // response yet, e.g. when the selection is restored from the URL on page load.
  useEffect(() => {
    for (const ref of values) {
      const uid = parseOwnerRef(ref)?.uid;
      if (!uid || teamByUid[uid] || requestedUids.current.has(uid)) {
        continue;
      }
      requestedUids.current.add(uid);
      getTeam({ name: uid }, true).then(async ({ data, status }) => {
        const display =
          status === QueryStatus.fulfilled && data
            ? { label: data.spec.title, imgUrl: await getTeamGravatarUrl(data.spec.email, data.spec.title) }
            : { label: t('browse-dashboards.filters.owner-unknown-team', '[Unknown team]') };
        setTeamByUid((prev) => ({ ...prev, [uid]: display }));
      });
    }
  }, [values, teamByUid, getTeam]);

  const value = useMemo<Array<SelectableValue<string>>>(() => {
    return values.map((ref) => {
      const uid = parseOwnerRef(ref)?.uid;
      const team = uid ? teamByUid[uid] : undefined;
      return { value: ref, label: team?.label ?? uid ?? ref, imgUrl: team?.imgUrl };
    });
  }, [values, teamByUid]);

  return (
    <div className={styles.ownerFilter}>
      <AsyncMultiSelect<string>
        aria-label={t('browse-dashboards.filters.owner-aria-label', 'Owner filter')}
        loadOptions={loadOptions}
        defaultOptions
        value={value}
        onChange={(selectedOptions) => {
          onChange(selectedOptions.map((option) => option.value).filter((value) => value !== undefined));
        }}
        noOptionsMessage={t('browse-dashboards.filters.owner-no-options', 'No teams found')}
        loadingMessage={t('browse-dashboards.filters.owner-loading', 'Loading teams...')}
        placeholder={t('browse-dashboards.filters.owner-placeholder', 'Filter by owner')}
        isLoading={isFetching}
        prefix={error ? <LoadErrorTooltip error={error} /> : <Icon name="filter" />}
      />
    </div>
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
  errorIcon: css({
    display: 'inline-flex',
    alignItems: 'center',
    color: theme.colors.error.text,
    cursor: 'help',
  }),
});

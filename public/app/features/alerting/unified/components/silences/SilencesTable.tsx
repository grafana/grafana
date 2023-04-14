import { css } from '@emotion/css';
import React, { useCallback, useMemo } from 'react';

import { dateMath, GrafanaTheme2 } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { Button, Icon, Link, useStyles2 } from '@grafana/ui';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { contextSrv } from 'app/core/services/context_srv';
import { AlertmanagerAlert, Silence, SilenceState } from 'app/plugins/datasource/alertmanager/types';
import { useDispatch } from 'app/types';

import { expireSilenceAction } from '../../state/actions';
import { getInstancesPermissions } from '../../utils/access-control';
import { parseMatchers } from '../../utils/alertmanager';
import { getSilenceFiltersFromUrlParams, makeAMLink } from '../../utils/misc';
import { Authorize } from '../Authorize';
import { DynamicTable, DynamicTableColumnProps, DynamicTableItemProps } from '../DynamicTable';
import { ActionButton } from '../rules/ActionButton';
import { ActionIcon } from '../rules/ActionIcon';

import { Matchers } from './Matchers';
import { NoSilencesSplash } from './NoSilencesCTA';
import { SilenceDetails } from './SilenceDetails';
import { SilenceStateTag } from './SilenceStateTag';
import { SilencesFilter } from './SilencesFilter';

export interface SilenceTableItem extends Silence {
  silencedAlerts: AlertmanagerAlert[];
}

type SilenceTableColumnProps = DynamicTableColumnProps<SilenceTableItem>;
type SilenceTableItemProps = DynamicTableItemProps<SilenceTableItem>;
interface Props {
  silences: Silence[];
  alertManagerAlerts: AlertmanagerAlert[];
  alertManagerSourceName: string;
}

const SilencesTable = ({ silences, alertManagerAlerts, alertManagerSourceName }: Props) => {
  const styles = useStyles2(getStyles);
  const [queryParams] = useQueryParams();
  const filteredSilences = useFilteredSilences(silences);
  const permissions = getInstancesPermissions(alertManagerSourceName);

  const { silenceState } = getSilenceFiltersFromUrlParams(queryParams);

  const showExpiredSilences =
    !!filteredSilences.length && (silenceState === undefined || silenceState === SilenceState.Expired);

  const nonExpiredColums = useColumns(alertManagerSourceName, false);
  const expiredColums = useColumns(alertManagerSourceName, true);

  const findSilencedAlerts = useCallback(
    (id: string) => {
      return alertManagerAlerts.filter((alert) => alert.status.silencedBy.includes(id));
    },
    [alertManagerAlerts]
  );

  const notExpiredItems = useMemo((): SilenceTableItemProps[] => {
    return filteredSilences
      .map((silence) => {
        const silencedAlerts = findSilencedAlerts(silence.id);
        return {
          id: silence.id,
          data: { ...silence, silencedAlerts },
        };
      })
      .filter((item: SilenceTableItemProps) => item.data.status.state !== SilenceState.Expired);
  }, [filteredSilences, findSilencedAlerts]);

  const expiredItems = useMemo((): SilenceTableItemProps[] => {
    return filteredSilences
      .map((silence) => {
        const silencedAlerts = findSilencedAlerts(silence.id);
        return {
          id: silence.id,
          data: { ...silence, silencedAlerts },
        };
      })
      .filter((item: SilenceTableItemProps) => item.data.status.state === SilenceState.Expired);
  }, [filteredSilences, findSilencedAlerts]);

  return (
    <div data-testid="silences-table">
      {!!silences.length && (
        <>
          <SilencesFilter />
          <Authorize actions={[permissions.create]} fallback={contextSrv.isEditor}>
            <div className={styles.topButtonContainer}>
              <Link href={makeAMLink('/alerting/silence/new', alertManagerSourceName)}>
                <Button className={styles.addNewSilence} icon="plus">
                  Add Silence
                </Button>
              </Link>
            </div>
          </Authorize>

          <>
            {!!notExpiredItems.length ? (
              <DynamicTable
                dataTestId="not-expired-table"
                items={notExpiredItems}
                cols={nonExpiredColums}
                isExpandable
                renderExpandedContent={({ data }) => <SilenceDetails silence={data} />}
              />
            ) : (
              'No matching silences found'
            )}
            {showExpiredSilences && (
              <>
                <div className={styles.callout}>
                  <Icon className={styles.calloutIcon} name="info-circle" />
                  <span>Expired silences are automatically deleted after 5 days.</span>
                </div>
                <DynamicTable
                  dataTestId="expired-table"
                  items={expiredItems}
                  cols={expiredColums}
                  isExpandable
                  renderExpandedContent={({ data }) => <SilenceDetails silence={data} />}
                />
              </>
            )}
          </>
        </>
      )}
      {!silences.length && <NoSilencesSplash alertManagerSourceName={alertManagerSourceName} />}
    </div>
  );
};

const useFilteredSilences = (silences: Silence[]) => {
  const [queryParams] = useQueryParams();
  return useMemo(() => {
    const { queryString, silenceState } = getSilenceFiltersFromUrlParams(queryParams);
    const silenceIdsString = queryParams?.silenceIds;
    return silences.filter((silence) => {
      if (typeof silenceIdsString === 'string') {
        const idsIncluded = silenceIdsString.split(',').includes(silence.id);
        if (!idsIncluded) {
          return false;
        }
      }
      if (queryString) {
        const matchers = parseMatchers(queryString);
        const matchersMatch = matchers.every((matcher) =>
          silence.matchers?.some(
            ({ name, value, isEqual, isRegex }) =>
              matcher.name === name &&
              matcher.value === value &&
              matcher.isEqual === isEqual &&
              matcher.isRegex === isRegex
          )
        );
        if (!matchersMatch) {
          return false;
        }
      }
      if (silenceState) {
        const stateMatches = silence.status.state === silenceState;
        if (!stateMatches) {
          return false;
        }
      }
      return true;
    });
  }, [queryParams, silences]);
};

const getStyles = (theme: GrafanaTheme2) => ({
  topButtonContainer: css`
    display: flex;
    flex-direction: row;
    justify-content: flex-end;
  `,
  addNewSilence: css`
    margin: ${theme.spacing(2, 0)};
  `,
  callout: css`
    background-color: ${theme.colors.background.secondary};
    border-top: 3px solid ${theme.colors.info.border};
    border-radius: ${theme.shape.borderRadius()};
    height: 62px;
    display: flex;
    flex-direction: row;
    align-items: center;
    margin-top: ${theme.spacing(2)};

    & > * {
      margin-left: ${theme.spacing(1)};
    }
  `,
  calloutIcon: css`
    color: ${theme.colors.info.text};
  `,
  editButton: css`
    margin-left: ${theme.spacing(0.5)};
  `,
});

function useColumns(alertManagerSourceName: string, expired: boolean) {
  const dispatch = useDispatch();
  const styles = useStyles2(getStyles);
  const permissions = getInstancesPermissions(alertManagerSourceName);
  return useMemo((): SilenceTableColumnProps[] => {
    const handleExpireSilenceClick = (id: string) => {
      dispatch(expireSilenceAction(alertManagerSourceName, id));
    };
    const showActions = contextSrv.hasAccess(permissions.update, contextSrv.isEditor);
    const columns: SilenceTableColumnProps[] = [
      {
        id: 'state',
        label: 'State',
        renderCell: function renderStateTag({ data: { status } }) {
          return <SilenceStateTag state={status.state} />;
        },
        size: 4,
      },
      {
        id: 'matchers',
        label: 'Matching labels',
        renderCell: function renderMatchers({ data: { matchers } }) {
          return <Matchers matchers={matchers || []} />;
        },
        size: 10,
      },
      ...(!expired
        ? [
            {
              id: 'alerts',
              label: 'Alerts',
              renderCell: function renderSilencedAlerts({
                data: { silencedAlerts },
              }: DynamicTableItemProps<SilenceTableItem>) {
                return <span data-testid="alerts">{silencedAlerts.length}</span>;
              },
              size: 4,
            },
          ]
        : [
            {
              id: 'alerts',
              label: '',
              renderCell: function renderSilencedAlerts() {
                return <span />;
              },
              size: 4,
            },
          ]),
      {
        id: 'schedule',
        label: 'Schedule',
        renderCell: function renderSchedule({ data: { startsAt, endsAt } }) {
          const startsAtDate = dateMath.parse(startsAt);
          const endsAtDate = dateMath.parse(endsAt);
          const dateDisplayFormat = 'YYYY-MM-DD HH:mm';
          return (
            <>
              {' '}
              {startsAtDate?.format(dateDisplayFormat)} {'-'}
              {endsAtDate?.format(dateDisplayFormat)}
            </>
          );
        },
        size: 7,
      },
    ];
    if (showActions) {
      columns.push({
        id: 'actions',
        label: 'Actions',
        renderCell: function renderActions({ data: silence }) {
          return (
            <Stack gap={0.5}>
              {silence.status.state === 'expired' ? (
                <Link href={makeAMLink(`/alerting/silence/${silence.id}/edit`, alertManagerSourceName)}>
                  <ActionButton icon="sync">Recreate</ActionButton>
                </Link>
              ) : (
                <ActionButton
                  icon="bell"
                  onClick={() => handleExpireSilenceClick(silence.id)}
                  tooltip="Expires the silence."
                >
                  Unsilence
                </ActionButton>
              )}
              {silence.status.state !== 'expired' && (
                <ActionIcon
                  className={styles.editButton}
                  to={makeAMLink(`/alerting/silence/${silence.id}/edit`, alertManagerSourceName)}
                  icon="pen"
                  tooltip="edit"
                />
              )}
            </Stack>
          );
        },
        size: 5,
      });
    }
    return columns;
  }, [alertManagerSourceName, dispatch, styles, permissions, expired]);
}

export default SilencesTable;

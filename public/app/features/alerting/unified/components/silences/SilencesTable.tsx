import React, { FC, useMemo, useCallback } from 'react';
import { GrafanaTheme2, dateMath } from '@grafana/data';
import { Icon, useStyles2, Link, Button } from '@grafana/ui';
import { css } from '@emotion/css';
import { AlertmanagerAlert, Silence, SilenceState } from 'app/plugins/datasource/alertmanager/types';
import SilenceTableRow from './SilenceTableRow';
import { getAlertTableStyles } from '../../styles/table';
import { NoSilencesSplash } from './NoSilencesCTA';
import { getFiltersFromUrlParams, makeAMLink } from '../../utils/misc';
import { contextSrv } from 'app/core/services/context_srv';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { SilencesFilter } from './SilencesFilter';
import { parseMatchers } from '../../utils/alertmanager';
import { DynamicTable, DynamicTableColumnProps, DynamicTableItemProps } from '../DynamicTable';
import { SilenceStateTag } from './SilenceStateTag';
import { Matchers } from './Matchers';
import { ActionButton } from '../rules/ActionButton';
import { ActionIcon } from '../rules/ActionIcon';
import { useDispatch } from 'react-redux';
import { expireSilenceAction } from '../../state/actions';

interface SilenceTableItem extends Silence {
  silencedAlerts: AlertmanagerAlert[];
}

type SilenceTableColumnProps = DynamicTableColumnProps<SilenceTableItem>;
type SilenceTableItemProps = DynamicTableItemProps<SilenceTableItem>;
interface Props {
  silences: Silence[];
  alertManagerAlerts: AlertmanagerAlert[];
  alertManagerSourceName: string;
}

const SilencesTable: FC<Props> = ({ silences, alertManagerAlerts, alertManagerSourceName }) => {
  const styles = useStyles2(getStyles);
  const tableStyles = useStyles2(getAlertTableStyles);
  const [queryParams] = useQueryParams();
  const filteredSilences = useFilteredSilences(silences);

  const { silenceState } = getFiltersFromUrlParams(queryParams);

  const showExpiredSilencesBanner =
    !!filteredSilences.length && (silenceState === undefined || silenceState === SilenceState.Expired);

  const findSilencedAlerts = useCallback(
    (id: string) => {
      return alertManagerAlerts.filter((alert) => alert.status.silencedBy.includes(id));
    },
    [alertManagerAlerts]
  );

  const columns = useColumns(alertManagerSourceName);

  const items = useMemo((): SilenceTableItemProps[] => {
    return filteredSilences.map((silence) => {
      const silencedAlerts = findSilencedAlerts(silence.id);
      return {
        id: silence.id,
        data: { ...silence, silencedAlerts },
      };
    });
  }, [filteredSilences, findSilencedAlerts]);

  return (
    <div data-testid="silences-table">
      {!!silences.length && (
        <>
          <SilencesFilter />
          {contextSrv.isEditor && (
            <div className={styles.topButtonContainer}>
              <Link href={makeAMLink('/alerting/silence/new', alertManagerSourceName)}>
                <Button className={styles.addNewSilence} icon="plus">
                  New Silence
                </Button>
              </Link>
            </div>
          )}
          <DynamicTable items={items} cols={columns} />
          <table className={tableStyles.table}>
            <colgroup>
              <col className={tableStyles.colExpand} />
              <col className={styles.colState} />
              <col className={styles.colMatchers} />
              <col />
              <col />
              {contextSrv.isEditor && <col />}
            </colgroup>
            <thead>
              <tr>
                <th />
                <th>State</th>
                <th>Matching labels</th>
                <th>Alerts</th>
                <th>Schedule</th>
                {contextSrv.isEditor && <th>Action</th>}
              </tr>
            </thead>
            <tbody>
              {filteredSilences.map((silence, index) => {
                const silencedAlerts = findSilencedAlerts(silence.id);
                return (
                  <SilenceTableRow
                    key={silence.id}
                    silence={silence}
                    className={index % 2 === 0 ? tableStyles.evenRow : undefined}
                    silencedAlerts={silencedAlerts}
                    alertManagerSourceName={alertManagerSourceName}
                  />
                );
              })}
            </tbody>
          </table>
          {showExpiredSilencesBanner && (
            <div className={styles.callout}>
              <Icon className={styles.calloutIcon} name="info-circle" />
              <span>Expired silences are automatically deleted after 5 days.</span>
            </div>
          )}
        </>
      )}
      {!silences.length && <NoSilencesSplash alertManagerSourceName={alertManagerSourceName} />}
    </div>
  );
};

const useFilteredSilences = (silences: Silence[]) => {
  const [queryParams] = useQueryParams();
  return useMemo(() => {
    const { queryString, silenceState } = getFiltersFromUrlParams(queryParams);
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
  colState: css`
    width: 110px;
  `,
  colMatchers: css`
    width: 50%;
  `,
  callout: css`
    background-color: ${theme.colors.background.secondary};
    border-top: 3px solid ${theme.colors.info.border};
    border-radius: 2px;
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
});

function useColumns(alertManagerSourceName: string) {
  const dispatch = useDispatch();
  return useMemo((): SilenceTableColumnProps[] => {
    const handleExpireSilenceClick = (id: string) => {
      dispatch(expireSilenceAction(alertManagerSourceName, id));
    };
    const showActions = contextSrv.isEditor;
    const columns: SilenceTableColumnProps[] = [
      {
        id: 'state',
        label: 'State',
        renderCell: function renderStateTag({ data: { status } }) {
          return <SilenceStateTag state={status.state} />;
        },
      },
      {
        id: 'matchers',
        label: 'Matching labels',
        renderCell: function renderMatchers({ data: { matchers } }) {
          return <Matchers matchers={matchers || []} />;
        },
      },
      {
        id: 'alerts',
        label: 'Alerts',
        renderCell: ({ data: { silencedAlerts } }) => silencedAlerts.length,
      },
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
              <br />
              {endsAtDate?.format(dateDisplayFormat)}
            </>
          );
        },
      },
    ];
    if (showActions) {
      columns.push({
        id: 'actions',
        label: 'Actions',
        renderCell: function renderActions({ data: silence }) {
          return (
            <>
              {silence.status.state === 'expired' ? (
                <Link href={makeAMLink(`/alerting/silence/${silence.id}/edit`, alertManagerSourceName)}>
                  <ActionButton icon="sync">Recreate</ActionButton>
                </Link>
              ) : (
                <ActionButton icon="bell" onClick={() => handleExpireSilenceClick(silence.id)}>
                  Unsilence
                </ActionButton>
              )}
              {silence.status.state !== 'expired' && (
                <ActionIcon
                  to={makeAMLink(`/alerting/silence/${silence.id}/edit`, alertManagerSourceName)}
                  icon="pen"
                  tooltip="edit"
                />
              )}
            </>
          );
        },
      });
    }
    return columns;
  }, [alertManagerSourceName, dispatch]);
}

export default SilencesTable;

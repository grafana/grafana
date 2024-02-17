import { css } from '@emotion/css';
import React, { useMemo } from 'react';

import { dateMath, GrafanaTheme2 } from '@grafana/data';
import { CollapsableSection, Icon, Link, LinkButton, useStyles2, Stack } from '@grafana/ui';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { AlertmanagerAlert, Silence, SilenceState } from 'app/plugins/datasource/alertmanager/types';
import { useDispatch } from 'app/types';

import { AlertmanagerAction, useAlertmanagerAbility } from '../../hooks/useAbilities';
import { expireSilenceAction } from '../../state/actions';
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
  const filteredSilencesNotExpired = useFilteredSilences(silences, false);
  const filteredSilencesExpired = useFilteredSilences(silences, true);

  const { silenceState: silenceStateInParams } = getSilenceFiltersFromUrlParams(queryParams);
  const showExpiredFromUrl = silenceStateInParams === SilenceState.Expired;

  const itemsNotExpired = useMemo((): SilenceTableItemProps[] => {
    const findSilencedAlerts = (id: string) => {
      return alertManagerAlerts.filter((alert) => alert.status.silencedBy.includes(id));
    };
    return filteredSilencesNotExpired.map((silence) => {
      const silencedAlerts = findSilencedAlerts(silence.id);
      return {
        id: silence.id,
        data: { ...silence, silencedAlerts },
      };
    });
  }, [filteredSilencesNotExpired, alertManagerAlerts]);

  const itemsExpired = useMemo((): SilenceTableItemProps[] => {
    const findSilencedAlerts = (id: string) => {
      return alertManagerAlerts.filter((alert) => alert.status.silencedBy.includes(id));
    };
    return filteredSilencesExpired.map((silence) => {
      const silencedAlerts = findSilencedAlerts(silence.id);
      return {
        id: silence.id,
        data: { ...silence, silencedAlerts },
      };
    });
  }, [filteredSilencesExpired, alertManagerAlerts]);

  return (
    <div data-testid="silences-table">
      {!!silences.length && (
        <Stack direction="column">
          <SilencesFilter />
          <Authorize actions={[AlertmanagerAction.CreateSilence]}>
            <div className={styles.topButtonContainer}>
              <LinkButton href={makeAMLink('/alerting/silence/new', alertManagerSourceName)} icon="plus">
                Add Silence
              </LinkButton>
            </div>
          </Authorize>
          <SilenceList
            items={itemsNotExpired}
            alertManagerSourceName={alertManagerSourceName}
            dataTestId="not-expired-table"
          />
          {itemsExpired.length > 0 && (
            <CollapsableSection label={`Expired silences (${itemsExpired.length})`} isOpen={showExpiredFromUrl}>
              <div className={styles.callout}>
                <Icon className={styles.calloutIcon} name="info-circle" />
                <span>Expired silences are automatically deleted after 5 days.</span>
              </div>
              <SilenceList
                items={itemsExpired}
                alertManagerSourceName={alertManagerSourceName}
                dataTestId="expired-table"
              />
            </CollapsableSection>
          )}
        </Stack>
      )}
      {!silences.length && <NoSilencesSplash alertManagerSourceName={alertManagerSourceName} />}
    </div>
  );
};

function SilenceList({
  items,
  alertManagerSourceName,
  dataTestId,
}: {
  items: SilenceTableItemProps[];
  alertManagerSourceName: string;
  dataTestId: string;
}) {
  const columns = useColumns(alertManagerSourceName);
  if (!!items.length) {
    return (
      <DynamicTable
        pagination={{ itemsPerPage: 25 }}
        items={items}
        cols={columns}
        isExpandable
        dataTestId={dataTestId}
        renderExpandedContent={({ data }) => <SilenceDetails silence={data} />}
      />
    );
  } else {
    return <>No matching silences found</>;
  }
}

const useFilteredSilences = (silences: Silence[], expired = false) => {
  const [queryParams] = useQueryParams();
  return useMemo(() => {
    const { queryString } = getSilenceFiltersFromUrlParams(queryParams);
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
      if (expired) {
        return silence.status.state === SilenceState.Expired;
      } else {
        return silence.status.state !== SilenceState.Expired;
      }
    });
  }, [queryParams, silences, expired]);
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
    border-radius: ${theme.shape.radius.default};
    height: 62px;
    display: flex;
    flex-direction: row;
    align-items: center;

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

function useColumns(alertManagerSourceName: string) {
  const dispatch = useDispatch();
  const styles = useStyles2(getStyles);
  const [updateSupported, updateAllowed] = useAlertmanagerAbility(AlertmanagerAction.UpdateSilence);

  return useMemo((): SilenceTableColumnProps[] => {
    const handleExpireSilenceClick = (id: string) => {
      dispatch(expireSilenceAction(alertManagerSourceName, id));
    };
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
      {
        id: 'alerts',
        label: 'Alerts',
        renderCell: function renderSilencedAlerts({ data: { silencedAlerts } }) {
          return <span data-testid="alerts">{silencedAlerts.length}</span>;
        },
        size: 4,
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
              {endsAtDate?.format(dateDisplayFormat)}
            </>
          );
        },
        size: 7,
      },
    ];
    if (updateSupported && updateAllowed) {
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
                <ActionButton icon="bell" onClick={() => handleExpireSilenceClick(silence.id)}>
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
  }, [alertManagerSourceName, dispatch, styles.editButton, updateAllowed, updateSupported]);
}
export default SilencesTable;

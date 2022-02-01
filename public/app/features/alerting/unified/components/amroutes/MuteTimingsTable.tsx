import React, { FC, useMemo, useState } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { IconButton, LinkButton, Link, useStyles2, ConfirmModal } from '@grafana/ui';
import { AlertManagerCortexConfig, MuteTimeInterval, TimeInterval } from 'app/plugins/datasource/alertmanager/types';
import { useDispatch } from 'react-redux';
import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import { deleteMuteTimingAction } from '../../state/actions';
import { makeAMLink } from '../../utils/misc';
import { AsyncRequestState, initialAsyncRequestState } from '../../utils/redux';
import { DynamicTable, DynamicTableItemProps, DynamicTableColumnProps } from '../DynamicTable';
import {
  getTimeString,
  getWeekdayString,
  getDaysOfMonthString,
  getMonthsString,
  getYearsString,
} from '../../utils/alertmanager';
import { EmptyAreaWithCTA } from '../EmptyAreaWithCTA';

interface Props {
  alertManagerSourceName: string;
  muteTimingNames?: string[];
  hideActions?: boolean;
}

export const MuteTimingsTable: FC<Props> = ({ alertManagerSourceName, muteTimingNames, hideActions }) => {
  const styles = useStyles2(getStyles);
  const dispatch = useDispatch();
  const amConfigs = useUnifiedAlertingSelector((state) => state.amConfigs);
  const [muteTimingName, setMuteTimingName] = useState<string>('');
  const { result }: AsyncRequestState<AlertManagerCortexConfig> =
    (alertManagerSourceName && amConfigs[alertManagerSourceName]) || initialAsyncRequestState;

  const items = useMemo((): Array<DynamicTableItemProps<MuteTimeInterval>> => {
    const muteTimings = result?.alertmanager_config?.mute_time_intervals ?? [];
    return muteTimings
      .filter(({ name }) => (muteTimingNames ? muteTimingNames.includes(name) : true))
      .map((mute) => {
        return {
          id: mute.name,
          data: mute,
        };
      });
  }, [result?.alertmanager_config?.mute_time_intervals, muteTimingNames]);

  const columns = useColumns(alertManagerSourceName, hideActions, setMuteTimingName);

  return (
    <div className={styles.container}>
      {!hideActions && <h5>Mute timings</h5>}
      {!hideActions && (
        <p>
          Mute timings are a named interval of time that may be referenced in the notification policy tree to mute
          particular notification policies for specific times of the day.
        </p>
      )}
      {!hideActions && items.length > 0 && (
        <LinkButton
          className={styles.addMuteButton}
          icon="plus"
          variant="primary"
          href={makeAMLink('alerting/routes/mute-timing/new', alertManagerSourceName)}
        >
          New mute timing
        </LinkButton>
      )}
      {items.length > 0 ? (
        <DynamicTable items={items} cols={columns} />
      ) : !hideActions ? (
        <EmptyAreaWithCTA
          text="You haven't created any mute timings yet"
          buttonLabel="Add mute timing"
          buttonIcon="plus"
          buttonSize="lg"
          href={makeAMLink('alerting/routes/mute-timing/new', alertManagerSourceName)}
        />
      ) : (
        <p>No mute timings configured</p>
      )}
      {!hideActions && (
        <ConfirmModal
          isOpen={!!muteTimingName}
          title="Delete mute timing"
          body={`Are you sure you would like to delete "${muteTimingName}"`}
          confirmText="Delete"
          onConfirm={() => dispatch(deleteMuteTimingAction(alertManagerSourceName, muteTimingName))}
          onDismiss={() => setMuteTimingName('')}
        />
      )}
    </div>
  );
};

function useColumns(alertManagerSourceName: string, hideActions = false, setMuteTimingName: (name: string) => void) {
  return useMemo((): Array<DynamicTableColumnProps<MuteTimeInterval>> => {
    const columns: Array<DynamicTableColumnProps<MuteTimeInterval>> = [
      {
        id: 'name',
        label: 'Name',
        renderCell: function renderName({ data }) {
          return data.name;
        },
        size: '250px',
      },
      {
        id: 'timeRange',
        label: 'Time range',
        renderCell: ({ data }) => renderTimeIntervals(data.time_intervals),
      },
    ];
    if (!hideActions) {
      columns.push({
        id: 'actions',
        label: 'Actions',
        renderCell: function renderActions({ data }) {
          return (
            <div>
              <Link
                href={makeAMLink(`/alerting/routes/mute-timing/edit`, alertManagerSourceName, { muteName: data.name })}
              >
                <IconButton name="edit" title="Edit mute timing" />
              </Link>
              <IconButton name={'trash-alt'} title="Delete mute timing" onClick={() => setMuteTimingName(data.name)} />
            </div>
          );
        },
        size: '100px',
      });
    }
    return columns;
  }, [alertManagerSourceName, hideActions, setMuteTimingName]);
}

function renderTimeIntervals(timeIntervals: TimeInterval[]) {
  return timeIntervals.map((interval, index) => {
    const { times, weekdays, days_of_month, months, years } = interval;
    const timeString = getTimeString(times);
    const weekdayString = getWeekdayString(weekdays);
    const daysString = getDaysOfMonthString(days_of_month);
    const monthsString = getMonthsString(months);
    const yearsString = getYearsString(years);

    return (
      <React.Fragment key={JSON.stringify(interval) + index}>
        {`${timeString} ${weekdayString}`}
        <br />
        {[daysString, monthsString, yearsString].join(' | ')}
        <br />
      </React.Fragment>
    );
  });
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css`
    display: flex;
    flex-flow: column nowrap;
  `,
  addMuteButton: css`
    margin-bottom: ${theme.spacing(2)};
    align-self: flex-end;
  `,
});

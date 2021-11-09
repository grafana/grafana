import { IconButton, LinkButton, Link } from '@grafana/ui';
import { MuteTimeInterval, TimeInterval } from 'app/plugins/datasource/alertmanager/types';
import React, { FC, useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { deleteMuteTimingAction } from '../../state/actions';
import { makeAMLink } from '../../utils/misc';
import { DynamicTable, DynamicTableItemProps, DynamicTableColumnProps } from '../DynamicTable';

interface Props {
  alertManagerSourceName: string;
  muteTimings: MuteTimeInterval[];
}

export const MuteTimingsTable: FC<Props> = ({ alertManagerSourceName, muteTimings }) => {
  const items = useMemo((): Array<DynamicTableItemProps<MuteTimeInterval>> => {
    return muteTimings.map((mute) => {
      return {
        id: mute.name,
        data: mute,
      };
    });
  }, [muteTimings]);

  const columns = useColumns(alertManagerSourceName);

  return (
    <div>
      <h5>Mute timings</h5>
      <DynamicTable items={items} cols={columns} />
      <LinkButton variant="secondary" href={makeAMLink('alerting/routes/mute-timing/new', alertManagerSourceName)}>
        Add mute timing
      </LinkButton>
    </div>
  );
};

function useColumns(alertManagerSourceName: string) {
  const dispatch = useDispatch();
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
        renderCell: ({ data }) => parseTimings(data.time_intervals),
      },
      {
        id: 'actions',
        label: 'Actions',
        renderCell: function renderActions({ data }) {
          return (
            <div>
              <Link href={makeAMLink(`alerting/routes/mute-timing/${btoa(data.name)}/edit`, alertManagerSourceName)}>
                <IconButton name="edit" title="Edit mute timing" />
              </Link>
              <IconButton
                name={'trash-alt'}
                title="Delete mute timing"
                onClick={() => dispatch(deleteMuteTimingAction(alertManagerSourceName, data.name))}
              />
            </div>
          );
        },
        size: '140px',
      },
    ];
    return columns;
  }, [alertManagerSourceName, dispatch]);
}

function parseTimings(timeIntervals: TimeInterval[]) {
  return timeIntervals.map((interval, index) => {
    const { times, weekdays, days_of_month, months, years } = interval;
    const timeString = times
      ? times?.map(({ start_time, end_time }) => `${start_time} - ${end_time}`).join(' and ')
      : '';
    const weekdayString =
      weekdays
        ?.map((day) => {
          if (day.includes(':')) {
            return day
              .split(':')
              .map((d) => {
                const abbreviated = d.slice(0, 3);
                return abbreviated[0].toLocaleUpperCase() + abbreviated.substr(1);
              })
              .join('-');
          } else {
            const abbreviated = day.slice(0, 3);
            return abbreviated[0].toLocaleUpperCase() + abbreviated.substr(1);
          }
        })
        .join(', ') ?? '';

    const daysString = 'Days of the month: ' + (days_of_month?.join(', ') ?? 'All');
    const monthsString = 'Months: ' + (months?.join(', ') ?? 'All');
    const yearsString = 'Years: ' + (years?.join(', ') ?? 'All');

    return (
      <React.Fragment key={JSON.stringify(interval) + index}>
        {`${timeString} ${weekdayString && 'on ' + weekdayString}`}
        <br />
        {[daysString, monthsString, yearsString].join(' | ')}
      </React.Fragment>
    );
  });
}

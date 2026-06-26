import { MuteTimeInterval } from 'app/plugins/datasource/alertmanager/types';

import { renderTimeIntervals } from './util';

describe('renderTimeIntervals', () => {
  it('should render empty time interval', () => {
    const muteTiming: MuteTimeInterval = {
      name: 'test',
      time_intervals: [],
    };

    expect(renderTimeIntervals(muteTiming)).toMatchSnapshot();
  });

  it('should render time interval with time range', () => {
    const muteTiming: MuteTimeInterval = {
      name: 'test',
      time_intervals: [
        {
          times: [
            {
              start_time: '12:00',
              end_time: '13:00',
            },
            {
              start_time: '14:00',
              end_time: '15:00',
            },
          ],
        },
      ],
    };

    expect(renderTimeIntervals(muteTiming)).toMatchSnapshot();
  });

  it('should render time interval with weekdays', () => {
    const muteTiming: MuteTimeInterval = {
      name: 'test',
      time_intervals: [
        {
          weekdays: ['monday', 'tuesday:thursday', 'sunday'],
        },
      ],
    };

    expect(renderTimeIntervals(muteTiming)).toMatchSnapshot();
  });

  it('should render time interval with kitchen sink', () => {
    const interval = {
      weekdays: ['monday', 'tuesday:thursday', 'sunday'],
      times: [
        {
          start_time: '12:00',
          end_time: '13:00',
        },
        {
          start_time: '14:00',
          end_time: '15:00',
        },
      ],
      days_of_month: ['1', '2:4', '31'],
      location: 'Europe/Berlin',
      months: ['january', 'february:march', 'december'],
      years: ['2019', '2020:2021'],
    };

    const muteTiming: MuteTimeInterval = {
      name: 'test',
      time_intervals: [interval, interval],
    };

    expect(renderTimeIntervals(muteTiming)).toMatchSnapshot();
  });
});

import React from 'react';
import { storiesOf } from '@storybook/react';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { TimePickerPopOver } from './TimePickerPopOver';

import { action } from '@storybook/addon-actions';
import moment from 'moment';
import { TimeRange, TimeFragment } from '../../types/time';
import { UseState } from '../../utils/storybook/UseState';

const TimePickerPopOverStories = storiesOf('UI/TimePicker/TimePickerPopOver', module);

TimePickerPopOverStories.addDecorator(withCenteredStory);

TimePickerPopOverStories.add('default', () => (
  <UseState
    initialState={{
      from: moment(),
      to: moment(),
      raw: { from: 'now-6h' as TimeFragment, to: 'now' as TimeFragment },
    }}
  >
    {(value, updateValue) => {
      return (
        <TimePickerPopOver
          value={value}
          isTimezoneUtc={false}
          onChange={(timeRange: TimeRange) => {
            action('onChange fired')(timeRange);
            updateValue(timeRange);
          }}
          popOverTimeOptions={{
            '0': [
              {
                from: 'now-2d',
                to: 'now',
                display: 'Last 2 days',
                section: 0,
                active: false,
              },
              {
                from: 'now-7d',
                to: 'now',
                display: 'Last 7 days',
                section: 0,
                active: false,
              },
              {
                from: 'now-30d',
                to: 'now',
                display: 'Last 30 days',
                section: 0,
                active: false,
              },
              {
                from: 'now-90d',
                to: 'now',
                display: 'Last 90 days',
                section: 0,
                active: false,
              },
              {
                from: 'now-6M',
                to: 'now',
                display: 'Last 6 months',
                section: 0,
                active: false,
              },
              {
                from: 'now-1y',
                to: 'now',
                display: 'Last 1 year',
                section: 0,
                active: false,
              },
              {
                from: 'now-2y',
                to: 'now',
                display: 'Last 2 years',
                section: 0,
                active: false,
              },
              {
                from: 'now-5y',
                to: 'now',
                display: 'Last 5 years',
                section: 0,
                active: false,
              },
            ],
            '1': [
              {
                from: 'now-1d/d',
                to: 'now-1d/d',
                display: 'Yesterday',
                section: 1,
                active: false,
              },
              {
                from: 'now-2d/d',
                to: 'now-2d/d',
                display: 'Day before yesterday',
                section: 1,
                active: false,
              },
              {
                from: 'now-7d/d',
                to: 'now-7d/d',
                display: 'This day last week',
                section: 1,
                active: false,
              },
              {
                from: 'now-1w/w',
                to: 'now-1w/w',
                display: 'Previous week',
                section: 1,
                active: false,
              },
              {
                from: 'now-1M/M',
                to: 'now-1M/M',
                display: 'Previous month',
                section: 1,
                active: false,
              },
              {
                from: 'now-1y/y',
                to: 'now-1y/y',
                display: 'Previous year',
                section: 1,
                active: false,
              },
            ],
            '2': [
              {
                from: 'now/d',
                to: 'now/d',
                display: 'Today',
                section: 2,
                active: true,
              },
              {
                from: 'now/d',
                to: 'now',
                display: 'Today so far',
                section: 2,
                active: false,
              },
              {
                from: 'now/w',
                to: 'now/w',
                display: 'This week',
                section: 2,
                active: false,
              },
              {
                from: 'now/w',
                to: 'now',
                display: 'This week so far',
                section: 2,
                active: false,
              },
              {
                from: 'now/M',
                to: 'now/M',
                display: 'This month',
                section: 2,
                active: false,
              },
              {
                from: 'now/M',
                to: 'now',
                display: 'This month so far',
                section: 2,
                active: false,
              },
              {
                from: 'now/y',
                to: 'now/y',
                display: 'This year',
                section: 2,
                active: false,
              },
              {
                from: 'now/y',
                to: 'now',
                display: 'This year so far',
                section: 2,
                active: false,
              },
            ],
          }}
        />
      );
    }}
  </UseState>
));

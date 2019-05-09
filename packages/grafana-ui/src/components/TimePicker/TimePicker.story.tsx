import React from 'react';
import moment, { Moment } from 'moment';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import { TimePicker } from './TimePicker';
import { UseState } from '../../utils/storybook/UseState';
import { withRighAlignedStory } from '../../utils/storybook/withRightAlignedStory';

const TimePickerStories = storiesOf('UI/TimePicker', module);

TimePickerStories.addDecorator(withRighAlignedStory);

TimePickerStories.add('default', () => {
  return (
    <UseState
      initialState={{
        from: moment(),
        to: moment(),
        raw: { from: 'now-6h' as string | Moment, to: 'now' as string | Moment },
      }}
    >
      {(value, updateValue) => {
        return (
          <TimePicker
            isTimezoneUtc={false}
            value={value}
            tooltipContent="TimePicker tooltip"
            selectOptions={[
              { from: 'now-5m', to: 'now', display: 'Last 5 minutes', section: 3, active: false },
              { from: 'now-15m', to: 'now', display: 'Last 15 minutes', section: 3, active: false },
              { from: 'now-30m', to: 'now', display: 'Last 30 minutes', section: 3, active: false },
              { from: 'now-1h', to: 'now', display: 'Last 1 hour', section: 3, active: false },
              { from: 'now-3h', to: 'now', display: 'Last 3 hours', section: 3, active: false },
              { from: 'now-6h', to: 'now', display: 'Last 6 hours', section: 3, active: false },
              { from: 'now-12h', to: 'now', display: 'Last 12 hours', section: 3, active: false },
              { from: 'now-24h', to: 'now', display: 'Last 24 hours', section: 3, active: false },
            ]}
            onChange={timeRange => {
              action('onChange fired')(timeRange);
              updateValue(timeRange);
            }}
            onMoveBackward={() => {
              action('onMoveBackward fired')();
            }}
            onMoveForward={() => {
              action('onMoveForward fired')();
            }}
            onZoom={() => {
              action('onZoom fired')();
            }}
          />
        );
      }}
    </UseState>
  );
});

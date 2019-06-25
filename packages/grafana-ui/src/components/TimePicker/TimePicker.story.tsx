import React from 'react';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import { TimePicker } from './TimePicker';
import { UseState } from '../../utils/storybook/UseState';
import { withRighAlignedStory } from '../../utils/storybook/withRightAlignedStory';
import { TimeFragment } from '../../types/time';
import { dateTime } from '../../utils/moment_wrapper';

const TimePickerStories = storiesOf('UI/TimePicker', module);

TimePickerStories.addDecorator(withRighAlignedStory);

TimePickerStories.add('default', () => {
  return (
    <UseState
      initialState={{
        from: dateTime(),
        to: dateTime(),
        raw: { from: 'now-6h' as TimeFragment, to: 'now' as TimeFragment },
      }}
    >
      {(value, updateValue) => {
        return (
          <TimePicker
            timeZone="browser"
            value={value}
            selectOptions={[
              { from: 'now-5m', to: 'now', display: 'Last 5 minutes', section: 3 },
              { from: 'now-15m', to: 'now', display: 'Last 15 minutes', section: 3 },
              { from: 'now-30m', to: 'now', display: 'Last 30 minutes', section: 3 },
              { from: 'now-1h', to: 'now', display: 'Last 1 hour', section: 3 },
              { from: 'now-3h', to: 'now', display: 'Last 3 hours', section: 3 },
              { from: 'now-6h', to: 'now', display: 'Last 6 hours', section: 3 },
              { from: 'now-12h', to: 'now', display: 'Last 12 hours', section: 3 },
              { from: 'now-24h', to: 'now', display: 'Last 24 hours', section: 3 },
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

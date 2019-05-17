import React from 'react';
import { action } from '@storybook/addon-actions';

import { storiesOf } from '@storybook/react';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { TimePickerPopover } from './TimePickerPopover';
import { UseState } from '../../utils/storybook/UseState';
import { popoverOptions } from './TimePicker.story';
import { dateTime, DateTime } from '../../utils/moment_wrapper';

const TimePickerPopoverStories = storiesOf('UI/TimePicker/TimePickerPopover', module);

TimePickerPopoverStories.addDecorator(withCenteredStory);

TimePickerPopoverStories.add('default', () => (
  <UseState
    initialState={{
      from: dateTime(),
      to: dateTime(),
      raw: { from: 'now-6h' as string | DateTime, to: 'now' as string | DateTime },
    }}
  >
    {(value, updateValue) => {
      return (
        <TimePickerPopover
          value={value}
          isTimezoneUtc={false}
          onChange={timeRange => {
            action('onChange fired')(timeRange);
            updateValue(timeRange);
          }}
          options={popoverOptions}
        />
      );
    }}
  </UseState>
));

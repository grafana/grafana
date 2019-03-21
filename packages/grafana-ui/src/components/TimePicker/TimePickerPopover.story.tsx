import React from 'react';
import { action } from '@storybook/addon-actions';
import moment, { Moment } from 'moment';

import { storiesOf } from '@storybook/react';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { TimePickerPopover } from './TimePickerPopover';
import { UseState } from '../../utils/storybook/UseState';
import { popoverOptions } from './TimePicker.story';

const TimePickerPopoverStories = storiesOf('UI/TimePicker/TimePickerPopover', module);

TimePickerPopoverStories.addDecorator(withCenteredStory);

TimePickerPopoverStories.add('default', () => (
  <UseState
    initialState={{
      from: moment(),
      to: moment(),
      raw: { from: 'now-6h' as string | Moment, to: 'now' as string | Moment },
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

import React from 'react';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { TimePickerCalendar } from './TimePickerCalendar';
import { UseState } from '../../utils/storybook/UseState';
import { TimeFragment } from '../../types/time';

const TimePickerCalendarStories = storiesOf('UI/TimePicker/TimePickerCalendar', module);

TimePickerCalendarStories.addDecorator(withCenteredStory);

TimePickerCalendarStories.add('default', () => (
  <UseState initialState={'now-6h' as TimeFragment}>
    {(value, updateValue) => {
      return (
        <TimePickerCalendar
          timeZone="browser"
          value={value}
          onChange={timeRange => {
            action('onChange fired')(timeRange);
            updateValue(timeRange);
          }}
        />
      );
    }}
  </UseState>
));

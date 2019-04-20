import React from 'react';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { Moment } from 'moment';

import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { TimePickerCalendar } from './TimePickerCalendar';
import { UseState } from '../../utils/storybook/UseState';

const TimePickerCalendarStories = storiesOf('UI/TimePicker/TimePickerCalendar', module);

TimePickerCalendarStories.addDecorator(withCenteredStory);

TimePickerCalendarStories.add('default', () => (
  <UseState initialState={'now-6h' as string | Moment}>
    {(value, updateValue) => {
      return (
        <TimePickerCalendar
          isTimezoneUtc={false}
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

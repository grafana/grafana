import React from 'react';
import { storiesOf } from '@storybook/react';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { TimePickerCalendar, CalendarType } from './TimePickerCalendar';
import moment from 'moment';

const TimePickerCalendarStories = storiesOf('UI/TimePicker/TimePickerCalendar', module);

TimePickerCalendarStories.addDecorator(withCenteredStory);

TimePickerCalendarStories.add('default', () => {
  return (
    <TimePickerCalendar
      calendarType={CalendarType.From}
      value={{
        from: moment(),
        to: moment(),
        raw: {
          from: moment(),
          to: moment(),
        },
      }}
    />
  );
});

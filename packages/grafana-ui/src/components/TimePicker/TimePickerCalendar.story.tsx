import React from 'react';
import { storiesOf } from '@storybook/react';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { TimePickerCalendar } from './TimePickerCalendar';

const TimePickerCalendarStories = storiesOf('UI/TimePicker/TimePickerCalendar', module);

TimePickerCalendarStories.addDecorator(withCenteredStory);

TimePickerCalendarStories.add('default', () => {
  return <TimePickerCalendar />;
});

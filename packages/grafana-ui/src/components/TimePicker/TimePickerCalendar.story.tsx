import React from 'react';
import { storiesOf } from '@storybook/react';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { TimePickerCalendar } from '../../../../../public/app/core/components/TimePicker/TimePickerCalendar';

const TimePickerCalendarStories = storiesOf('UI/TimePicker/TimePickerCalendar', module);

TimePickerCalendarStories.addDecorator(withCenteredStory);

TimePickerCalendarStories.add('default', () => {
  return <TimePickerCalendar />;
});

import React, { useState } from 'react';
import { Story } from '@storybook/react';
import { dateTime, DateTime } from '@grafana/data';
import { DateTimePicker, Props } from './DateTimePicker';
import { withCenteredStory } from '../../../utils/storybook/withCenteredStory';

export default {
  title: 'Pickers and Editors/TimePickers/DateTimePicker',
  decorators: [withCenteredStory],
  component: DateTimePicker,
};

export const Basic: Story<Props> = () => {
  const [date, setDate] = useState<DateTime>(dateTime());
  return <DateTimePicker label="Date" date={date} onChange={setDate} />;
};

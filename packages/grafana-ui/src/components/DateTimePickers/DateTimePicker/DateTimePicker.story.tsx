import React, { useState } from 'react';
import { Story, Meta } from '@storybook/react';
import { dateTime, DateTime } from '@grafana/data';
import { DateTimePicker, Props } from './DateTimePicker';
import { withCenteredStory } from '../../../utils/storybook/withCenteredStory';
import mdx from './DateTimePicker.mdx';

export default {
  title: 'Pickers and Editors/TimePickers/DateTimePicker',
  decorators: [withCenteredStory],
  component: DateTimePicker,
  argTypes: {
    date: {
      table: { disable: true },
    },
    onChange: {
      table: { disable: true },
    },
  },
  parameters: {
    docs: {
      page: mdx,
    },
  },
} as Meta;

export const Basic: Story<Props> = ({ label }) => {
  const [date, setDate] = useState<DateTime>(dateTime('2021-05-05 12:00:00'));
  return <DateTimePicker label={label} date={date} onChange={setDate} />;
};

Basic.args = {
  label: 'Date',
};

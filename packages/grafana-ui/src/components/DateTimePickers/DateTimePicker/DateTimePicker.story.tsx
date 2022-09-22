import { ComponentStory, ComponentMeta } from '@storybook/react';
import React, { useState } from 'react';

import { dateTime, DateTime } from '@grafana/data';

import { withCenteredStory } from '../../../utils/storybook/withCenteredStory';

import { DateTimePicker } from './DateTimePicker';
import mdx from './DateTimePicker.mdx';

const meta: ComponentMeta<typeof DateTimePicker> = {
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
};

export const Basic: ComponentStory<typeof DateTimePicker> = ({ label }) => {
  const [date, setDate] = useState<DateTime>(dateTime('2021-05-05 12:00:00'));
  return <DateTimePicker label={label} date={date} onChange={setDate} />;
};

Basic.args = {
  label: 'Date',
};

export default meta;

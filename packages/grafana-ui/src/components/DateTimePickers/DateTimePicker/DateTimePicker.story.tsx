import { action } from '@storybook/addon-actions';
import { ComponentStory, ComponentMeta } from '@storybook/react';
import React, { useState } from 'react';

import { dateTime, DateTime } from '@grafana/data';

import { withCenteredStory } from '../../../utils/storybook/withCenteredStory';

import { DateTimePicker } from './DateTimePicker';
import mdx from './DateTimePicker.mdx';

const today = new Date();

// minimum date is initially set to 7 days before to allow the user
// to quickly see its effects
const minimumDate = new Date();
minimumDate.setDate(minimumDate.getDate() - 7);

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
    minDate: { control: 'date' },
    maxDate: { control: 'date' },
    showSeconds: { control: 'boolean' },
  },
  args: {
    minDate: minimumDate,
    maxDate: today,
    showSeconds: true,
  },
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

export const OnlyWorkingHoursEnabled: ComponentStory<typeof DateTimePicker> = ({
  label,
  minDate,
  maxDate,
  showSeconds,
}) => {
  const [date, setDate] = useState<DateTime>(dateTime(today));
  // the minDate arg can change from Date object to number, we need to handle this
  // scenario to avoid a crash in the component's story.
  const minDateVal = typeof minDate === 'number' ? new Date(minDate) : minDate;
  const maxDateVal = typeof maxDate === 'number' ? new Date(maxDate) : maxDate;

  return (
    <DateTimePicker
      label={label}
      disabledHours={() => [0, 1, 2, 3, 4, 5, 6, 19, 20, 21, 22, 23]}
      minDate={minDateVal}
      maxDate={maxDateVal}
      date={date}
      showSeconds={showSeconds}
      onChange={(newValue) => {
        action('on change')(newValue);
        setDate(newValue);
      }}
    />
  );
};

export const Basic: ComponentStory<typeof DateTimePicker> = ({ label, minDate, maxDate, showSeconds }) => {
  const [date, setDate] = useState<DateTime>(dateTime(today));
  // the minDate arg can change from Date object to number, we need to handle this
  // scenario to avoid a crash in the component's story.
  const minDateVal = typeof minDate === 'number' ? new Date(minDate) : minDate;
  const maxDateVal = typeof maxDate === 'number' ? new Date(maxDate) : maxDate;

  return (
    <DateTimePicker
      label={label}
      minDate={minDateVal}
      maxDate={maxDateVal}
      date={date}
      showSeconds={showSeconds}
      onChange={(newValue) => {
        action('on change')(newValue);
        setDate(newValue);
      }}
    />
  );
};

Basic.args = {
  label: 'Date',
};

export default meta;

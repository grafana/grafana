import { action } from '@storybook/addon-actions';
import { useArgs } from '@storybook/preview-api';
import { Meta, StoryFn } from '@storybook/react';
import { useId } from 'react';

import { dateTime } from '@grafana/data';

import { Field } from '../Forms/Field';

import { TimeOfDayPicker } from './TimeOfDayPicker';

const meta: Meta<typeof TimeOfDayPicker> = {
  title: 'Date time pickers/TimeOfDayPicker',
  component: TimeOfDayPicker,
  parameters: {
    controls: {
      exclude: ['onChange'],
    },
  },
  args: {
    value: dateTime(Date.now()),
  },
  argTypes: { value: { control: 'date' } },
};

export const Basic: StoryFn<typeof TimeOfDayPicker> = (args) => {
  const [, updateArgs] = useArgs();
  const id = useId();
  return (
    <Field label="Select a time">
      <TimeOfDayPicker
        {...args}
        id={id}
        onChange={(newValue?) => {
          action('on selected')(newValue);
          updateArgs({ value: newValue });
        }}
      />
    </Field>
  );
};

export default meta;

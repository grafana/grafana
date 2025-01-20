import { action } from '@storybook/addon-actions';
import { useArgs } from '@storybook/preview-api';
import { Meta, StoryFn } from '@storybook/react';

import { dateTime } from '@grafana/data';

import { TimeOfDayPicker } from './TimeOfDayPicker';

const meta: Meta<typeof TimeOfDayPicker> = {
  title: 'Pickers and Editors/TimePickers/TimeOfDayPicker',
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
  return (
    <TimeOfDayPicker
      {...args}
      onChange={(newValue?) => {
        action('on selected')(newValue);
        updateArgs({ value: newValue });
      }}
    />
  );
};

export default meta;

import { action } from '@storybook/addon-actions';
import { useArgs } from '@storybook/preview-api';
import { Meta, StoryFn } from '@storybook/react';

import { TimeZonePicker } from './TimeZonePicker';

const meta: Meta<typeof TimeZonePicker> = {
  title: 'Pickers and Editors/TimePickers/TimeZonePicker',
  component: TimeZonePicker,
  parameters: {
    controls: {
      exclude: ['inputId', 'onChange', 'onBlur'],
    },
  },
  args: {
    value: 'Europe/Stockholm',
  },
  argTypes: {
    includeInternal: {
      control: {
        type: 'boolean',
      },
    },
  },
};

export const Basic: StoryFn<typeof TimeZonePicker> = (args) => {
  const [, updateArgs] = useArgs();
  return (
    <TimeZonePicker
      {...args}
      onChange={(newValue) => {
        action('on selected')(newValue);
        updateArgs({ value: newValue });
      }}
      onBlur={action('onBlur')}
    />
  );
};

export default meta;

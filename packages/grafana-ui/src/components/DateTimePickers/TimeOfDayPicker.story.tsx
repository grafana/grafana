import { action } from '@storybook/addon-actions';
import { useArgs } from '@storybook/client-api';
import { ComponentMeta, ComponentStory } from '@storybook/react';
import React from 'react';

import { dateTime } from '@grafana/data';
import { TimeOfDayPicker } from '@grafana/ui';

import { withCenteredStory } from '../../utils/storybook/withCenteredStory';

const meta: ComponentMeta<typeof TimeOfDayPicker> = {
  title: 'Pickers and Editors/TimePickers/TimeOfDayPicker',
  component: TimeOfDayPicker,
  decorators: [withCenteredStory],
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

export const Basic: ComponentStory<typeof TimeOfDayPicker> = (args) => {
  const [, updateArgs] = useArgs();
  return (
    <TimeOfDayPicker
      {...args}
      onChange={(newValue) => {
        action('on selected')(newValue);
        updateArgs({ value: newValue });
      }}
    />
  );
};

export default meta;

import { action } from '@storybook/addon-actions';
import { useArgs } from '@storybook/client-api';
import { Meta, StoryFn } from '@storybook/react';
import React from 'react';

import { withCenteredStory } from '../../../utils/storybook/withCenteredStory';

import { RelativeTimeRangePicker } from './RelativeTimeRangePicker';

const meta: Meta<typeof RelativeTimeRangePicker> = {
  title: 'Pickers and Editors/TimePickers/RelativeTimeRangePicker',
  component: RelativeTimeRangePicker,
  decorators: [withCenteredStory],
  parameters: {
    controls: {
      exclude: ['onChange'],
    },
  },
  args: {
    timeRange: {
      from: 900,
      to: 0,
    },
  },
};

export const Basic: StoryFn<typeof RelativeTimeRangePicker> = (args) => {
  const [, updateArgs] = useArgs();
  return (
    <RelativeTimeRangePicker
      {...args}
      onChange={(value) => {
        action('onChange')(value);
        updateArgs({ timeRange: value });
      }}
    />
  );
};

export default meta;

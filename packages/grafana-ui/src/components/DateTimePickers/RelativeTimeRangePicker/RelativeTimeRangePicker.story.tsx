import { type Meta, type StoryFn } from '@storybook/react-webpack5';
import { action } from 'storybook/actions';
import { useArgs } from 'storybook/preview-api';

import { RelativeTimeRangePicker } from './RelativeTimeRangePicker';

const meta: Meta<typeof RelativeTimeRangePicker> = {
  title: 'Date time pickers/RelativeTimeRangePicker',
  component: RelativeTimeRangePicker,
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

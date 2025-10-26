import { action } from '@storybook/addon-actions';
import { useArgs } from '@storybook/preview-api';
import { Meta, StoryFn } from '@storybook/react';

import { RefreshPicker } from './RefreshPicker';
import mdx from './RefreshPicker.mdx';

const meta: Meta<typeof RefreshPicker> = {
  title: 'Pickers/RefreshPicker',
  component: RefreshPicker,
  parameters: {
    docs: {
      page: mdx,
    },
    controls: {
      sort: 'alpha',
    },
  },
  args: {
    isLoading: false,
    isLive: false,
    width: 'auto',
    text: 'Run query',
    tooltip: 'My tooltip text goes here',
    value: '1h',
    primary: false,
    noIntervalPicker: false,
    intervals: ['5s', '10s', '30s', '1m', '5m', '15m', '30m', '1h', '2h', '1d'],
  },
};

export const Examples: StoryFn<typeof RefreshPicker> = (args) => {
  const [, updateArgs] = useArgs();
  const onIntervalChanged = (interval: string) => {
    action('onIntervalChanged fired')(interval);
    updateArgs({ value: interval });
  };

  const onRefresh = () => {
    action('onRefresh fired')();
  };

  return (
    <RefreshPicker
      tooltip={args.tooltip}
      value={args.value}
      text={args.text}
      isLoading={args.isLoading}
      intervals={args.intervals}
      width={args.width}
      onIntervalChanged={onIntervalChanged}
      onRefresh={onRefresh}
      noIntervalPicker={args.noIntervalPicker}
      primary={args.primary}
    />
  );
};

export default meta;

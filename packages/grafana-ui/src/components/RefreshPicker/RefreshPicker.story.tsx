import { action } from '@storybook/addon-actions';
import { useArgs } from '@storybook/client-api';
import { ComponentMeta, ComponentStory } from '@storybook/react';
import React from 'react';

import { RefreshPicker } from '@grafana/ui';

import { withCenteredStory } from '../../utils/storybook/withCenteredStory';

import mdx from './RefreshPicker.mdx';

const meta: ComponentMeta<typeof RefreshPicker> = {
  title: 'Pickers and Editors/RefreshPicker',
  component: RefreshPicker,
  decorators: [withCenteredStory],
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

export const Examples: ComponentStory<typeof RefreshPicker> = (args) => {
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

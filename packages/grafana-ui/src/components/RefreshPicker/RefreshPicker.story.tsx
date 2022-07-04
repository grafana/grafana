import { action } from '@storybook/addon-actions';
import { Story } from '@storybook/react';
import React from 'react';

import { RefreshPicker } from '@grafana/ui';

// import { DashboardStoryCanvas } from '../../utils/storybook/DashboardStoryCanvas';
// import { StoryExample } from '../../utils/storybook/StoryExample';
// import { UseState } from '../../utils/storybook/UseState';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
// import { HorizontalGroup } from '../Layout/Layout';

import { Props } from './RefreshPicker';
import mdx from './RefreshPicker.mdx';

export default {
  title: 'Pickers and Editors/RefreshPicker',
  component: RefreshPicker,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
  },
  args: {
    isLoading: false,
    isLive: false,
    width: '35px',
    text: 'Run query',
    tooltip: 'Run query',
    value: '1h',
  },
  argTypes: {
    intervals: {
      control: {
        type: 'select',
      },
    },
  },
};

export const Examples: Story<Props> = (args) => {
  const [valueState, setValueState] = React.useState('');
  const intervals = ['5s', '10s', '30s', '1m', '5m', '15m', '30m', '1h', '2h', '1d'];
  const onIntervalChanged = (interval: string) => {
    action('onIntervalChanged fired')(interval);
    setValueState(interval);
  };

  const onRefresh = () => {
    action('onRefresh fired')();
  };

  return (
    <RefreshPicker
      tooltip={args.tooltip}
      value={valueState}
      text={args.text}
      isLoading={args.isLoading}
      intervals={intervals}
      width={args.width}
      onIntervalChanged={onIntervalChanged}
      onRefresh={onRefresh}
      noIntervalPicker={args.noIntervalPicker}
      primary={args.primary}
    />
  );
};

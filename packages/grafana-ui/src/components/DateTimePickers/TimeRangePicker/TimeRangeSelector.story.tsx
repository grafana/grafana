import { type Meta, type StoryFn } from '@storybook/react';
import { action } from 'storybook/actions';
import { useArgs } from 'storybook/preview-api';

import { rangeUtil } from '@grafana/data';

import { TimeRangeSelector } from './TimeRangeSelector';
import mdx from './TimeRangeSelector.mdx';

const meta: Meta<typeof TimeRangeSelector> = {
  title: 'Date time pickers/TimeRangeSelector',
  component: TimeRangeSelector,
  args: {
    value: rangeUtil.convertRawToRange({ from: 'now-6h', to: 'now' }, 'utc'),
    timeZone: 'utc',
  },
  parameters: {
    docs: { page: mdx },
    controls: { exclude: ['onChange', 'onChangeTimeZone', 'onChangeFiscalYearStartMonth', 'onError'] },
  },
};

export const Basic: StoryFn<typeof TimeRangeSelector> = (args) => {
  const [, updateArgs] = useArgs();
  return (
    <TimeRangeSelector
      {...args}
      onChange={(value) => {
        action('onChange')(value);
        updateArgs({ value });
      }}
      onChangeTimeZone={(timeZone) => {
        action('onChangeTimeZone')(timeZone);
        updateArgs({ timeZone });
      }}
    />
  );
};

export default meta;

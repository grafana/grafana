import { type Meta, type StoryFn } from '@storybook/react';
import { action } from 'storybook/actions';
import { useArgs } from 'storybook/preview-api';

import { dateTime, DefaultTimeZone } from '@grafana/data';

import { TimeRangePicker } from './TimeRangePicker';

const to = dateTime();
const from = to.subtract(6, 'h');

const meta: Meta<typeof TimeRangePicker> = {
  title: 'Date time pickers/TimeRangePicker',
  component: TimeRangePicker,
  args: {
    value: {
      from,
      to,
      raw: {
        from: 'now-6h',
        to: 'now',
      },
    },
    timeZone: DefaultTimeZone,
    history: [],
  },
  parameters: {
    controls: {
      exclude: [
        'onChange',
        'onChangeTimeZone',
        'onChangeFiscalYearStartMonth',
        'onMoveBackward',
        'onMoveForward',
        'onZoom',
        'timeSyncButton',
      ],
    },
  },
};

export const Basic: StoryFn<typeof TimeRangePicker> = (args) => {
  const [, updateArgs] = useArgs();
  return (
    <TimeRangePicker
      {...args}
      onChange={(value) => {
        action('onChange')(value);
        updateArgs({
          value,
          history: args.history ? [...args.history, value] : [value],
        });
      }}
      onChangeTimeZone={(timeZone) => {
        action('onChangeTimeZone')(timeZone);
        updateArgs({
          timeZone,
        });
      }}
      onMoveBackward={action('onMoveBackward')}
      onMoveForward={action('onMoveForward')}
      onZoom={action('onZoom')}
    />
  );
};

export const Compact = Basic.bind({});
Compact.args = { compactDesign: 'tabs', widthOverride: 600 };

export const Embedded = Basic.bind({});
Embedded.args = {
  compactDesign: 'tabs',
  widthOverride: 600,
  hideHistory: true,
  hideTimeZone: true,
  hideFiscalYear: true,
};

export const CustomRelativeRanges = Basic.bind({});
CustomRelativeRanges.args = {
  ...Embedded.args,
  quickRanges: [
    { from: 'now-15m', to: 'now', display: 'Last 15 minutes' },
    { from: 'now-1h', to: 'now', display: 'Last hour' },
    { from: 'now-24h', to: 'now', display: 'Last 24 hours' },
  ],
};
CustomRelativeRanges.parameters = {
  docs: {
    description: {
      story:
        'quickRanges replaces the default presets. hideHistory=true omits recently used ranges. Custom-duration search remains available.',
    },
  },
};

export const Responsive = Basic.bind({});
Responsive.args = { compactDesign: 'tabs' };

export const Wide = Basic.bind({});
Wide.args = { compactDesign: 'tabs', widthOverride: 1200 };

export default meta;

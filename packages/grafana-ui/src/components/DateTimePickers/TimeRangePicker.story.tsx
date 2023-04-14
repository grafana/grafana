import { action } from '@storybook/addon-actions';
import { useArgs } from '@storybook/client-api';
import { ComponentMeta, ComponentStory } from '@storybook/react';
import React from 'react';

import { dateTime, DefaultTimeZone } from '@grafana/data';
import { TimeRangePicker } from '@grafana/ui';

import { withCenteredStory } from '../../utils/storybook/withCenteredStory';

const to = dateTime();
const from = to.subtract(6, 'h');

const meta: ComponentMeta<typeof TimeRangePicker> = {
  title: 'Pickers and Editors/TimePickers/TimeRangePicker',
  component: TimeRangePicker,
  decorators: [withCenteredStory],
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

export const Basic: ComponentStory<typeof TimeRangePicker> = (args) => {
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

export default meta;

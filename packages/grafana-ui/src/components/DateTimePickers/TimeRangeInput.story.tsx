import { action } from '@storybook/addon-actions';
import { useArgs } from '@storybook/client-api';
import { ComponentMeta, ComponentStory } from '@storybook/react';
import React from 'react';

import { dateTime, DefaultTimeZone } from '@grafana/data';
import { TimeRangeInput } from '@grafana/ui';

import { withCenteredStory } from '../../utils/storybook/withCenteredStory';

import mdx from './TimeRangeInput.mdx';

const now = dateTime(Date.now());

const meta: ComponentMeta<typeof TimeRangeInput> = {
  title: 'Pickers and Editors/TimePickers/TimeRangeInput',
  component: TimeRangeInput,
  decorators: [withCenteredStory],
  parameters: {
    controls: {
      exclude: ['onChange', 'onChangeTimeZone'],
    },
    docs: {
      page: mdx,
    },
  },
  args: {
    value: {
      from: now.subtract(6, 'h'),
      to: now,
      raw: {
        from: 'now-6h',
        to: 'now',
      },
    },
    timeZone: DefaultTimeZone,
  },
};

export const Basic: ComponentStory<typeof TimeRangeInput> = (args) => {
  const [, updateArgs] = useArgs();
  return (
    <TimeRangeInput
      {...args}
      onChange={(value) => {
        action('onChange fired')(value);
        updateArgs({
          value,
        });
      }}
      onChangeTimeZone={(timeZone) => {
        action('onChangeTimeZone fired')(timeZone);
        updateArgs({
          timeZone,
        });
      }}
    />
  );
};

export default meta;

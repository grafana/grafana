import React from 'react';
import { TimeRangeInput } from './TimeRangeInput';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import mdx from './TimeRangeInput.mdx';
import { UseState } from '../../utils/storybook/UseState';
import { dateTime, TimeFragment } from '@grafana/data';
import { action } from '@storybook/addon-actions';

export default {
  title: 'Forms/TimeRangeInput',
  component: TimeRangeInput,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

export const basic = () => {
  return (
    <UseState
      initialState={{
        from: dateTime(),
        to: dateTime(),
        raw: { from: 'now-6h' as TimeFragment, to: 'now' as TimeFragment },
      }}
    >
      {(value, updateValue) => {
        return (
          <TimeRangeInput
            timeZone="browser"
            value={value}
            onChange={timeRange => {
              action('onChange fired')(timeRange);
              updateValue(timeRange);
            }}
          />
        );
      }}
    </UseState>
  );
};

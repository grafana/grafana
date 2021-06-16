import React from 'react';
import { action } from '@storybook/addon-actions';
import { UseState } from '../../../utils/storybook/UseState';
import { withCenteredStory } from '../../../utils/storybook/withCenteredStory';
import { RelativeTimeRangePicker } from './RelativeTimeRangePicker';

export default {
  title: 'Pickers and Editors/TimePickers/RelativeTimeRangePicker',
  component: RelativeTimeRangePicker,
  decorators: [withCenteredStory],
  parameters: {
    docs: {},
  },
};

export const basic = () => {
  return (
    <UseState
      initialState={{
        from: 900,
        to: 0,
      }}
    >
      {(value, updateValue) => {
        return (
          <RelativeTimeRangePicker
            onChange={(newValue) => {
              action('on selected')(newValue);
              updateValue(newValue);
            }}
            timeRange={value}
          />
        );
      }}
    </UseState>
  );
};

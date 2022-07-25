import { action } from '@storybook/addon-actions';
import { ComponentMeta } from '@storybook/react';
import React from 'react';

import { UseState } from '../../../utils/storybook/UseState';
import { withCenteredStory } from '../../../utils/storybook/withCenteredStory';

import { RelativeTimeRangePicker } from './RelativeTimeRangePicker';

const meta: ComponentMeta<typeof RelativeTimeRangePicker> = {
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

export default meta;

import { action } from '@storybook/addon-actions';
import React from 'react';

import { WeekStartPicker } from '@grafana/ui';

import { UseState } from '../../utils/storybook/UseState';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';

export default {
  title: 'Pickers and Editors/TimePickers/WeekStartPicker',
  component: WeekStartPicker,
  decorators: [withCenteredStory],
};

export const basic = () => {
  return (
    <UseState
      initialState={{
        value: '',
      }}
    >
      {(value, updateValue) => {
        return (
          <WeekStartPicker
            value={value.value}
            onChange={(newValue: string) => {
              if (!newValue) {
                return;
              }
              action('on selected')(newValue);
              updateValue({ value: newValue });
            }}
          />
        );
      }}
    </UseState>
  );
};

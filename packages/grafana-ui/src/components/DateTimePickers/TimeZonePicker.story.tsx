import { action } from '@storybook/addon-actions';
import { ComponentMeta } from '@storybook/react';
import React from 'react';

import { TimeZonePicker } from '@grafana/ui';

import { UseState } from '../../utils/storybook/UseState';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';

const meta: ComponentMeta<typeof TimeZonePicker> = {
  title: 'Pickers and Editors/TimePickers/TimeZonePicker',
  component: TimeZonePicker,
  decorators: [withCenteredStory],
};

export const basic = () => {
  return (
    <UseState
      initialState={{
        value: 'Europe/Stockholm',
      }}
    >
      {(value, updateValue) => {
        return (
          <TimeZonePicker
            includeInternal={true}
            value={value.value}
            onChange={(newValue) => {
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

export default meta;

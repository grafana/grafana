import React from 'react';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import { TimeZonePicker } from './TimeZonePicker';
import { UseState } from '../../utils/storybook/UseState';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';

const TimeZonePickerStories = storiesOf('General/TimeZonePicker', module);

TimeZonePickerStories.addDecorator(withCenteredStory);

TimeZonePickerStories.add('default', () => {
  return (
    <UseState
      initialState={{
        value: 'Europe/Stockholm',
      }}
    >
      {(value, updateValue) => {
        return (
          <TimeZonePicker
            value={value.value}
            onChange={newValue => {
              action('on selected')(newValue);
              updateValue({ value: newValue });
            }}
            size="sm"
          />
        );
      }}
    </UseState>
  );
});

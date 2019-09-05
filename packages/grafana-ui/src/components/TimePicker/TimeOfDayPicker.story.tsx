import React from 'react';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import { TimeOfDayPicker } from './TimeOfDayPicker';
import { UseState } from '../../utils/storybook/UseState';
import { withRightAlignedStory } from '../../utils/storybook/withRightAlignedStory';
import { dateTime } from '@grafana/data';

const TimeOfDayPickerStories = storiesOf('UI/TimeOfDayPicker', module);

TimeOfDayPickerStories.addDecorator(withRightAlignedStory);

TimeOfDayPickerStories.add('default', () => {
  return (
    <UseState
      initialState={{
        value: dateTime(Date.now()),
      }}
    >
      {(value, updateValue) => {
        return (
          <TimeOfDayPicker
            onSelected={newValue => {
              action('on selected')(newValue);
              updateValue(newValue);
            }}
            value={dateTime(value.value)}
          />
        );
      }}
    </UseState>
  );
});

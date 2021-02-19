import React from 'react';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import { ToggleButton, ToggleButtonGroup } from './ToggleButtonGroup';
import { UseState } from '../../utils/storybook/UseState';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';

const ToggleButtonGroupStories = storiesOf('General/ToggleButtonGroup', module);

const options = [
  { value: 'first', label: 'First' },
  { value: 'second', label: 'Second' },
  { value: 'third', label: 'Third' },
];

ToggleButtonGroupStories.addDecorator(withCenteredStory);

ToggleButtonGroupStories.add('default', () => {
  return (
    <UseState
      initialState={{
        value: 'first',
      }}
    >
      {(value, updateValue) => {
        return (
          <ToggleButtonGroup label="Options">
            {options.map((option, index) => {
              return (
                <ToggleButton
                  key={`${option.value}-${index}`}
                  value={option.value}
                  onChange={newValue => {
                    action('on change')(newValue);
                    updateValue({ value: newValue });
                  }}
                  selected={value.value === option.value}
                >
                  {option.label}
                </ToggleButton>
              );
            })}
          </ToggleButtonGroup>
        );
      }}
    </UseState>
  );
});

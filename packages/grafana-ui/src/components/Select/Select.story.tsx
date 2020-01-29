import React from 'react';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { withKnobs, object } from '@storybook/addon-knobs';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { UseState } from '../../utils/storybook/UseState';
import { SelectableValue } from '@grafana/data';
import { Select } from './Select';

const SelectStories = storiesOf('UI/Select/Select', module);

SelectStories.addDecorator(withCenteredStory).addDecorator(withKnobs);

SelectStories.add('default', () => {
  const intialState: SelectableValue<string> = { label: 'A label', value: 'A value' };
  const value = object<SelectableValue<string>>('Selected Value:', intialState);
  const options = object<Array<SelectableValue<string>>>('Options:', [
    intialState,
    { label: 'Another label', value: 'Another value' },

    { label: 'Another label 1', value: ' 1Another value' },
    { label: 'Another label 2', value: '2 Another value' },
    { label: 'Another label 3', value: '3 Another value' },
    { label: 'Another label 4', value: '4 Another value' },
    { label: 'Another label 5', value: '5 Another value' },
    { label: 'Another label 6', value: '6 Another value' },
    { label: 'Another label 7', value: '7 Another value' },
    { label: 'Another label 8', value: '8 Another value' },
  ]);

  return (
    <UseState initialState={value}>
      {(value, updateValue) => {
        return (
          <Select
            placeholder="Choose..."
            options={options}
            onChange={value => {
              action('onChanged fired')(value);
              updateValue(value);
            }}
          />
        );
      }}
    </UseState>
  );
});

SelectStories.add('With allowCustomValue', () => {
  const intialState: SelectableValue<string> = { label: 'A label', value: 'A value' };
  // @ts-ignore
  const value = object<SelectableValue<string>>('Selected Value:', null);
  const options = object<Array<SelectableValue<string>>>('Options:', [
    intialState,
    { label: 'Another label', value: 'Another value' },
  ]);

  return (
    <UseState initialState={value}>
      {(value, updateValue) => {
        return (
          <Select
            // value={value}
            placeholder="Choose..."
            options={options}
            allowCustomValue={true}
            onChange={value => {
              action('onChanged fired')(value);
              updateValue(value);
            }}
          />
        );
      }}
    </UseState>
  );
});

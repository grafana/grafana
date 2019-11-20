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
  ]);

  return (
    <UseState initialState={value}>
      {(value, updateValue) => {
        return (
          <Select
            value={value}
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
  const value = object<SelectableValue<string>>('Selected Value:', intialState);
  const options = object<Array<SelectableValue<string>>>('Options:', [
    intialState,
    { label: 'Another label', value: 'Another value' },
  ]);

  return (
    <UseState initialState={value}>
      {(value, updateValue) => {
        return (
          <Select
            value={value}
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

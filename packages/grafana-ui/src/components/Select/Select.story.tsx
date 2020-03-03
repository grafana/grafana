import React from 'react';
import { action } from '@storybook/addon-actions';
import { withKnobs, object } from '@storybook/addon-knobs';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { UseState } from '../../utils/storybook/UseState';
import { SelectableValue } from '@grafana/data';
import { Select } from './Select';

export default {
  title: 'General/Select/Select',
  component: Select,
  decorators: [withCenteredStory, withKnobs],
};

export const basic = () => {
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
};

export const withAllowCustomValue = () => {
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
};

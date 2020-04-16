import React, { useState, useCallback } from 'react';
import { action } from '@storybook/addon-actions';
import { withKnobs, object } from '@storybook/addon-knobs';
import { withCenteredStory } from '../../../../utils/storybook/withCenteredStory';
import { UseState } from '../../../../utils/storybook/UseState';
import { SelectableValue } from '@grafana/data';
import { Select, AsyncSelect } from './Select';

export default {
  title: 'Forms/Legacy/Select',
  component: Select,
  decorators: [withCenteredStory, withKnobs],
};

const intialState: SelectableValue<string> = { label: 'A label', value: 'A value' };

const options = object<Array<SelectableValue<string>>>('Options:', [
  intialState,
  { label: 'Another label', value: 'Another value 1' },
  { label: 'Another label', value: 'Another value 2' },
  { label: 'Another label', value: 'Another value 3' },
  { label: 'Another label', value: 'Another value 4' },
  { label: 'Another label', value: 'Another value 5' },
  { label: 'Another label', value: 'Another value ' },
]);

export const basic = () => {
  const value = object<SelectableValue<string>>('Selected Value:', intialState);

  return (
    <UseState initialState={value}>
      {(value, updateValue) => {
        return (
          <Select
            placeholder="Choose..."
            options={options}
            width={20}
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
  // @ts-ignore
  const value = object<SelectableValue<string>>('Selected Value:', null);

  return (
    <UseState initialState={value}>
      {(value, updateValue) => {
        return (
          <Select
            // value={value}
            placeholder="Choose..."
            options={options}
            width={20}
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

export const asyncSelect = () => {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [value, setValue] = useState();
  const loadAsyncOptions = useCallback(
    inputValue => {
      return new Promise<Array<SelectableValue<string>>>(resolve => {
        setTimeout(() => {
          setIsLoading(false);
          resolve(options.filter(option => option.label && option.label.includes(inputValue)));
        }, 1000);
      });
    },
    [value]
  );
  return (
    <AsyncSelect
      value={value}
      defaultOptions
      width={20}
      isLoading={isLoading}
      loadOptions={loadAsyncOptions}
      onChange={value => {
        action('onChange')(value);
        setValue(value);
      }}
    />
  );
};

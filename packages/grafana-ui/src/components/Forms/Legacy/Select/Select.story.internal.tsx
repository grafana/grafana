import React, { useState, useCallback } from 'react';
import { action } from '@storybook/addon-actions';
import { withKnobs, object } from '@storybook/addon-knobs';
import { withCenteredStory } from '../../../../utils/storybook/withCenteredStory';
import { UseState } from '../../../../utils/storybook/UseState';
import { SelectableValue } from '@grafana/data';
import { Select, AsyncSelect as AsyncSelectComponent } from './Select';

export default {
  title: 'Forms/Legacy/Select',
  component: Select,
  decorators: [withCenteredStory, withKnobs],
};

const initialState: SelectableValue<string> = { label: 'A label', value: 'A value' };

const options = object<Array<SelectableValue<string>>>('Options:', [
  initialState,
  { label: 'Another label', value: 'Another value 1' },
  { label: 'Another label', value: 'Another value 2' },
  { label: 'Another label', value: 'Another value 3' },
  { label: 'Another label', value: 'Another value 4' },
  { label: 'Another label', value: 'Another value 5' },
  { label: 'Another label', value: 'Another value ' },
]);

export const basic = () => {
  const value = object<SelectableValue<string>>('Selected Value:', initialState);

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

export const AsyncSelect = () => {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [value, setValue] = useState<SelectableValue<any>>();
  const loadAsyncOptions = useCallback(inputValue => {
    return new Promise<Array<SelectableValue<string>>>(resolve => {
      setTimeout(() => {
        setIsLoading(false);
        resolve(options.filter(option => option.label && option.label.includes(inputValue)));
      }, 1000);
    });
  }, []);
  return (
    <AsyncSelectComponent
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

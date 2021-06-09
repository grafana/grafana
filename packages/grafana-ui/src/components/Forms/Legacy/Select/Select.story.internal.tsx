import React, { useState, useCallback } from 'react';
import { action } from '@storybook/addon-actions';
import { Meta, Story } from '@storybook/react';
import { withCenteredStory } from '../../../../utils/storybook/withCenteredStory';
import { UseState } from '../../../../utils/storybook/UseState';
import { SelectableValue } from '@grafana/data';
import { Select, AsyncSelect as AsyncSelectComponent } from './Select';

export default {
  title: 'Forms/Legacy/Select',
  component: Select,
  decorators: [withCenteredStory],
  parameters: {
    controls: {
      exclude: [
        'className',
        'menuPlacement',
        'menuPosition',
        'maxMenuHeight',
        'minMenuHeight',
        'maxVisibleValues',
        'prefix',
        'renderControl',
        'value',
        'tooltipContent',
        'components',
        'inputValue',
        'id',
        'inputId',
        'defaultValue',
        'loading',
        'aria-label',
      ],
    },
  },
  argTypes: {
    width: { control: { type: 'range', min: 5, max: 30 } },
  },
} as Meta;

const initialValue: SelectableValue<string> = { label: 'A label', value: 'A value' };

const options = [
  initialValue,
  { label: 'Another label', value: 'Another value 1' },
  { label: 'Another label', value: 'Another value 2' },
  { label: 'Another label', value: 'Another value 3' },
  { label: 'Another label', value: 'Another value 4' },
  { label: 'Another label', value: 'Another value 5' },
  { label: 'Another label', value: 'Another value ' },
];

export const Basic: Story = (args) => {
  return (
    <UseState initialState={initialValue}>
      {(value, updateValue) => {
        return (
          <Select
            {...args}
            onChange={(value: SelectableValue<string>) => {
              action('onChanged fired')(value);
              updateValue(value);
            }}
          />
        );
      }}
    </UseState>
  );
};
Basic.args = {
  placeholder: 'Choose...',
  options: options,
  width: 20,
};

export const AsyncSelect: Story = (args) => {
  const [isLoading, setIsLoading] = useState<boolean>(args.loading);
  const [asyncValue, setAsyncValue] = useState<SelectableValue<any>>();
  const loadAsyncOptions = useCallback((inputValue) => {
    return new Promise<Array<SelectableValue<string>>>((resolve) => {
      setTimeout(() => {
        setIsLoading(false);
        resolve(options.filter((option) => option.label && option.label.includes(inputValue)));
      }, 1000);
    });
  }, []);
  return (
    <AsyncSelectComponent
      {...args}
      value={asyncValue}
      isLoading={isLoading}
      loadOptions={loadAsyncOptions}
      onChange={(value) => {
        action('onChange')(value);
        setAsyncValue(value);
      }}
    />
  );
};
AsyncSelect.args = {
  loading: true,
  defaultOptions: true,
  width: 20,
};

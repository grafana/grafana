import { action } from '@storybook/addon-actions';
import { useArgs } from '@storybook/client-api';
import { Meta, StoryFn } from '@storybook/react';
import React, { useCallback } from 'react';

import { SelectableValue } from '@grafana/data';

import { withCenteredStory } from '../../../../utils/storybook/withCenteredStory';

import { Select, AsyncSelect as AsyncSelectComponent } from './Select';

const meta: Meta<typeof Select> = {
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
        'aria-label',
        'noOptionsMessage',
        'onChange',
        'onBlur',
        'onKeyDown',
        'filterOption',
        'formatCreateLabel',
        'getOptionLabel',
        'getOptionValue',
        'onCloseMenu',
        'onCreateOption',
        'onInputChange',
        'onOpenMenu',
        'isOptionDisabled',
      ],
    },
  },
  argTypes: {
    width: { control: { type: 'range', min: 5, max: 30 } },
  },
};

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

export const Basic: StoryFn<typeof Select> = (args) => {
  const [, updateArgs] = useArgs();
  return (
    <Select
      {...args}
      onChange={(value) => {
        action('onChange fired')(value);
        updateArgs({ value });
      }}
    />
  );
};
Basic.args = {
  placeholder: 'Choose...',
  options: options,
  width: 20,
};

export const AsyncSelect: StoryFn<typeof AsyncSelectComponent> = (args) => {
  const [, updateArgs] = useArgs();
  const loadAsyncOptions = useCallback(
    (inputValue: string) => {
      return new Promise<Array<SelectableValue<string>>>((resolve) => {
        setTimeout(() => {
          updateArgs({ isLoading: false });
          resolve(options.filter((option) => option.label && option.label.includes(inputValue)));
        }, 1000);
      });
    },
    [updateArgs]
  );
  return (
    <AsyncSelectComponent
      {...args}
      loadOptions={loadAsyncOptions}
      onChange={(value) => {
        action('onChange')(value);
        updateArgs({ value });
      }}
    />
  );
};
AsyncSelect.args = {
  isLoading: true,
  defaultOptions: true,
  width: 20,
};

export default meta;

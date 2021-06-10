import React, { useState } from 'react';
import { withCenteredStory, withHorizontallyCenteredStory } from '../../utils/storybook/withCenteredStory';
import { SelectableValue } from '@grafana/data';
import { Icon, Select, AsyncSelect, MultiSelect, AsyncMultiSelect } from '@grafana/ui';
import { getAvailableIcons, IconName } from '../../types';
import { SelectCommonProps } from './types';
import { Meta, Story } from '@storybook/react';
import { kebabCase } from 'lodash';
import { generateOptions } from './mockOptions';
import mdx from './Select.mdx';
import { auto } from '@popperjs/core';

export default {
  title: 'Forms/Select',
  component: Select,
  decorators: [withCenteredStory, withHorizontallyCenteredStory],
  subcomponents: { AsyncSelect, MultiSelect, AsyncMultiSelect },
  parameters: {
    docs: {
      page: mdx,
    },
    controls: {
      exclude: [
        'getOptionValue',
        'getOptionLabel',
        'formatCreateLabel',
        'filterOption',
        'className',
        'components',
        'defaultValue',
        'id',
        'inputId',
        'onBlur',
        'onChange',
        'onCloseMenu',
        'onCreateOption',
        'onInputChange',
        'onKeyDown',
        'onOpenMenu',
        'prefix',
        'renderControl',
        'options',
        'isOptionDisabled',
        'maxVisibleValues',
        'aria-label',
        'noOptionsMessage',
        'menuPosition',
        'value',
      ],
    },
  },
  args: {
    width: 0,
    disabled: false,
    isLoading: false,
    invalid: false,
    icon: 'arrow-down',
  },
  argTypes: {
    width: { control: { type: 'range', min: 1, max: 100 } },
    icon: {
      control: {
        type: 'select',
        options: getAvailableIcons(),
      },
    },
  },
} as Meta;

const loadAsyncOptions = () => {
  return new Promise<Array<SelectableValue<string>>>((resolve) => {
    setTimeout(() => {
      resolve(generateOptions());
    }, 2000);
  });
};

const getPrefix = (prefix: string) => {
  const prefixEl = <Icon name={prefix as IconName} />;
  return prefixEl;
};

interface StoryProps extends Partial<SelectCommonProps<string>> {
  icon: string;
}

export const Basic: Story<StoryProps> = (args) => {
  const [value, setValue] = useState<SelectableValue<string>>();

  return (
    <>
      <Select
        options={generateOptions()}
        value={value}
        onChange={(v) => {
          setValue(v);
        }}
        prefix={getPrefix(args.icon)}
        {...args}
      />
    </>
  );
};
/**
 * Uses plain values instead of SelectableValue<T>
 */
export const BasicSelectPlainValue: Story<StoryProps> = (args) => {
  const [value, setValue] = useState<string>();
  return (
    <>
      <Select
        options={generateOptions()}
        value={value}
        onChange={(v) => {
          setValue(v.value);
        }}
        prefix={getPrefix(args.icon)}
        {...args}
      />
    </>
  );
};
/**
 * Uses plain values instead of SelectableValue<T>
 */
export const SelectWithOptionDescriptions: Story = (args) => {
  // TODO this is not working with new Select

  const [value, setValue] = useState<number>();
  const options = [
    { label: 'Basic option', value: 0 },
    { label: 'Option with description', value: 1, description: 'this is a description' },
    {
      label: 'Option with description and image',
      value: 2,
      description: 'This is a very elaborate description, describing all the wonders in the world.',
      imgUrl: 'https://placekitten.com/40/40',
    },
  ];

  return (
    <>
      <Select
        options={options}
        value={value}
        onChange={(v) => {
          setValue(v.value);
        }}
        prefix={getPrefix(args.icon)}
        {...args}
      />
    </>
  );
};

/**
 * Uses plain values instead of SelectableValue<T>
 */
export const MultiPlainValue: Story = (args) => {
  const [value, setValue] = useState<string[]>();

  return (
    <>
      <MultiSelect
        options={generateOptions()}
        value={value}
        onChange={(v) => {
          setValue(v.map((v: any) => v.value));
        }}
        prefix={getPrefix(args.icon)}
        {...args}
      />
    </>
  );
};

export const MultiSelectWithOptionGroups: Story = (args) => {
  const [value, setValue] = useState<string[]>();

  return (
    <>
      <MultiSelect
        options={[
          { label: '1', value: '1' },
          { label: '2', value: '2', options: [{ label: '5', value: '5' }] },
        ]}
        value={value}
        onChange={(v) => {
          setValue(v.map((v: any) => v.value));
        }}
        prefix={getPrefix(args.icon)}
        {...args}
      />
    </>
  );
};

export const MultiSelectBasic: Story = (args) => {
  const [value, setValue] = useState<Array<SelectableValue<string>>>([]);

  return (
    <>
      <MultiSelect
        options={generateOptions()}
        value={value}
        onChange={(v) => {
          setValue(v);
        }}
        prefix={getPrefix(args.icon)}
        {...args}
      />
    </>
  );
};
MultiSelectBasic.args = {
  isClearable: false,
  closeMenuOnSelect: false,
  maxVisibleValues: 5,
};

export const MultiSelectAsync: Story = (args) => {
  const [value, setValue] = useState<Array<SelectableValue<string>>>();

  return (
    <AsyncMultiSelect
      loadOptions={loadAsyncOptions}
      defaultOptions
      value={value}
      onChange={(v) => {
        setValue(v);
      }}
      prefix={getPrefix(args.icon)}
      {...args}
    />
  );
};
MultiSelectAsync.args = {
  allowCustomValue: false,
};

export const BasicSelectAsync: Story = (args) => {
  const [value, setValue] = useState<SelectableValue<string>>();

  return (
    <AsyncSelect
      loadOptions={loadAsyncOptions}
      defaultOptions
      value={value}
      onChange={(v) => {
        setValue(v);
      }}
      prefix={getPrefix(args.icon)}
      {...args}
    />
  );
};

export const AutoMenuPlacement: Story = (args) => {
  const [value, setValue] = useState<SelectableValue<string>>();

  return (
    <>
      <div style={{ width: '100%', height: '95vh', display: 'flex', alignItems: 'flex-end' }}>
        <Select
          options={generateOptions()}
          value={value}
          onChange={(v) => {
            setValue(v);
          }}
          prefix={getPrefix(args.icon)}
          {...args}
        />
      </div>
    </>
  );
};
AutoMenuPlacement.args = {
  menuPlacement: auto,
};

export const CustomValueCreation: Story = (args) => {
  const [value, setValue] = useState<SelectableValue<string>>();
  const [customOptions, setCustomOptions] = useState<Array<SelectableValue<string>>>([]);
  const options = generateOptions();
  return (
    <>
      <Select
        options={[...options, ...customOptions]}
        value={value}
        onChange={(v) => {
          setValue(v);
        }}
        allowCustomValue={args.allowCustomValue}
        onCreateOption={(v) => {
          const customValue: SelectableValue<string> = { value: kebabCase(v), label: v };
          setCustomOptions([...customOptions, customValue]);
          setValue(customValue);
        }}
        prefix={getPrefix(args.icon)}
        {...args}
      />
    </>
  );
};
CustomValueCreation.args = {
  allowCustomValue: true,
};

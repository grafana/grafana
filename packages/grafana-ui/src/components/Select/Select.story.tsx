import { auto } from '@popperjs/core';
import { action } from '@storybook/addon-actions';
import { Meta, StoryFn } from '@storybook/react';
import Chance from 'chance';
import { useState } from 'react';

import { SelectableValue, toIconName } from '@grafana/data';

import { getAvailableIcons } from '../../types/icon';
import { Alert } from '../Alert/Alert';
import { Icon } from '../Icon/Icon';

import { AsyncMultiSelect, AsyncSelect, MultiSelect, Select } from './Select';
import mdx from './Select.mdx';
import { generateOptions, generateThousandsOfOptions } from './mockOptions';
import { SelectCommonProps } from './types';

const chance = new Chance();

const manyGroupedOptions = [
  { label: 'Foo', value: '1' },
  {
    label: 'Animals',
    options: new Array(100).fill(0).map((_, i) => {
      const animal = chance.animal();
      return { label: animal, value: animal };
    }),
  },
  {
    label: 'People',
    options: new Array(100).fill(0).map((_, i) => {
      const person = chance.name();
      return { label: person, value: person };
    }),
  },
  { label: 'Bar', value: '3' },
];

const meta: Meta = {
  title: 'Inputs/Deprecated/Select',
  component: Select,
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
        'aria-label',
        'noOptionsMessage',
        'menuPosition',
        'isValidNewOption',
        'value',
      ],
    },
    // TODO fix a11y issue in story and remove this
    a11y: { test: 'off' },
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
  decorators: [DeprecatedDecorator],
};

const loadAsyncOptions = () => {
  return new Promise<Array<SelectableValue<string>>>((resolve) => {
    setTimeout(() => {
      resolve(generateOptions());
    }, 2000);
  });
};

const getPrefix = (prefix: string) => {
  const prefixEl = <Icon name={toIconName(prefix) ?? 'question-circle'} />;
  return prefixEl;
};

interface StoryProps extends Partial<SelectCommonProps<string>> {
  icon: string;
}

export const Basic: StoryFn<StoryProps> = (args) => {
  const [value, setValue] = useState<SelectableValue<string>>();

  return (
    <>
      <Select
        options={generateOptions()}
        value={value}
        onChange={(v) => {
          setValue(v);
          action('onChange')(v);
        }}
        {...args}
      />
    </>
  );
};

export const BasicVirtualizedList: StoryFn<StoryProps> = (args) => {
  const [value, setValue] = useState<SelectableValue<string>>();

  return (
    <>
      <Select
        options={generateThousandsOfOptions()}
        virtualized
        value={value}
        onChange={(v) => {
          setValue(v);
          action('onChange')(v);
        }}
        {...args}
      />
    </>
  );
};

/**
 * Uses plain values instead of SelectableValue<T>
 */
export const BasicSelectPlainValue: StoryFn<StoryProps> = (args) => {
  const [value, setValue] = useState<string>();
  return (
    <>
      <Select
        options={generateOptions()}
        value={value}
        onChange={(v) => {
          setValue(v.value);
          action('onChange')(v);
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
export const SelectWithOptionDescriptions: StoryFn = (args) => {
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
          action('onChange')(v);
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
export const MultiPlainValue: StoryFn = (args) => {
  const [value, setValue] = useState<string[]>();

  return (
    <>
      <MultiSelect
        options={generateOptions()}
        value={value}
        onChange={(v) => {
          setValue(v.map((v) => v.value!));
        }}
        prefix={getPrefix(args.icon)}
        {...args}
      />
    </>
  );
};

export const MultiSelectWithOptionGroups: StoryFn = (args) => {
  const [value, setValue] = useState<string[]>();

  return (
    <>
      <MultiSelect
        options={[
          { label: 'Foo', value: '1' },
          {
            label: 'Colours',
            value: '2',
            options: [
              { label: 'Blue', value: '5' },
              { label: 'Red', value: '6' },
              { label: 'Black', value: '7' },
              { label: 'Yellow', value: '8' },
            ],
          },
          {
            label: 'Animals',
            value: '9',
            options: [
              { label: 'Cat', value: '10' },
              { label: 'Cow', value: '11' },
              { label: 'Dog', value: '12' },
              { label: 'Eagle', value: '13' },
            ],
          },
          { label: 'Bar', value: '3' },
        ]}
        value={value}
        onChange={(v) => {
          setValue(v.map((v) => v.value!));
          action('onChange')(v);
        }}
        prefix={getPrefix(args.icon)}
        {...args}
      />
    </>
  );
};

export const MultiSelectWithOptionGroupsVirtualized: StoryFn = (args) => {
  const [value, setValue] = useState<string[]>();

  return (
    <>
      <MultiSelect
        options={manyGroupedOptions}
        virtualized
        value={value}
        onChange={(v) => {
          setValue(v.map((v) => v.value!));
          action('onChange')(v);
        }}
        prefix={getPrefix(args.icon)}
        {...args}
      />
    </>
  );
};

export const MultiSelectBasic: StoryFn = (args) => {
  const [value, setValue] = useState<Array<SelectableValue<string>>>([]);

  return (
    <div style={{ maxWidth: '450px' }}>
      <MultiSelect
        options={generateOptions()}
        value={value}
        onChange={(v) => {
          setValue(v);
          action('onChange')(v);
        }}
        prefix={getPrefix(args.icon)}
        {...args}
      />
    </div>
  );
};

MultiSelectBasic.args = {
  isClearable: false,
  closeMenuOnSelect: false,
  maxVisibleValues: 5,
  noMultiValueWrap: false,
};

export const MultiSelectBasicWithSelectAll: StoryFn = (args) => {
  const [value, setValue] = useState<Array<SelectableValue<string>>>([]);

  return (
    <div style={{ maxWidth: '450px' }}>
      <MultiSelect
        options={generateOptions()}
        value={value}
        toggleAllOptions={{ enabled: true }}
        onChange={(v) => {
          setValue(v);
          action('onChange')(v);
        }}
        prefix={getPrefix(args.icon)}
        {...args}
      />
    </div>
  );
};

MultiSelectBasicWithSelectAll.args = {
  isClearable: false,
  closeMenuOnSelect: false,
  maxVisibleValues: 5,
  noMultiValueWrap: false,
};

export const MultiSelectAsync: StoryFn = (args) => {
  const [value, setValue] = useState<Array<SelectableValue<string>>>();

  return (
    <AsyncMultiSelect
      loadOptions={loadAsyncOptions}
      defaultOptions
      value={value}
      onChange={(v) => {
        setValue(v);
        action('onChange')(v);
      }}
      prefix={getPrefix(args.icon)}
      {...args}
    />
  );
};
MultiSelectAsync.args = {
  allowCustomValue: false,
};

export const BasicSelectAsync: StoryFn = (args) => {
  const [value, setValue] = useState<SelectableValue<string>>();

  return (
    <AsyncSelect
      loadOptions={loadAsyncOptions}
      defaultOptions
      value={value}
      onChange={(v) => {
        setValue(v);
        action('onChange')(v);
      }}
      prefix={getPrefix(args.icon)}
      {...args}
    />
  );
};

export const AutoMenuPlacement: StoryFn = (args) => {
  const [value, setValue] = useState<SelectableValue<string>>();

  return (
    <>
      <div style={{ width: '100%', height: 'calc(95vh - 118px)', display: 'flex', alignItems: 'flex-end' }}>
        <Select
          options={generateOptions()}
          value={value}
          onChange={(v) => {
            setValue(v);
            action('onChange')(v);
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

export const WidthAuto: StoryFn = (args) => {
  const [value, setValue] = useState<SelectableValue<string>>();

  return (
    <>
      <div style={{ width: '100%' }}>
        <Select
          options={generateOptions()}
          value={value}
          onChange={(v) => {
            setValue(v);
            action('onChange')(v);
          }}
          prefix={getPrefix(args.icon)}
          {...args}
          width="auto"
        />
      </div>
    </>
  );
};

export const CustomValueCreation: StoryFn = (args) => {
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
          action('onChange')(v);
        }}
        allowCustomValue={args.allowCustomValue}
        onCreateOption={(v) => {
          const customValue: SelectableValue<string> = { value: v, label: v };
          setCustomOptions([...customOptions, customValue]);
          setValue(customValue);
          action('onCreateOption')(v);
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

export default meta;

function DeprecatedDecorator(Story: React.ElementType) {
  return (
    <div>
      <Alert title="Deprecated!" severity="warning">
        The Select component is deprecated.
        <br />
        Use Combobox instead - it supports most use cases, is performant by default, and can handle hundreds of
        thousands of options, and has a simpler API.
      </Alert>

      <Story />
    </div>
  );
}

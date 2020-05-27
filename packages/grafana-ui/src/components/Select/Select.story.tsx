import React, { useState } from 'react';
import { Select, AsyncSelect, MultiSelect, AsyncMultiSelect } from './Select';
import { withCenteredStory, withHorizontallyCenteredStory } from '../../utils/storybook/withCenteredStory';
import { SelectableValue } from '@grafana/data';
import { getAvailableIcons, IconName } from '../../types';
import { select, boolean, number } from '@storybook/addon-knobs';
import { Icon } from '../Icon/Icon';
import { Button } from '../Button';
import { ButtonSelect } from './ButtonSelect';
import { getIconKnob } from '../../utils/storybook/knobs';
import kebabCase from 'lodash/kebabCase';
import { generateOptions } from './mockOptions';
import mdx from './Select.mdx';

export default {
  title: 'Forms/Select',
  component: Select,
  decorators: [withCenteredStory, withHorizontallyCenteredStory],
  subcomponents: { AsyncSelect, MultiSelect, AsyncMultiSelect },
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

const BEHAVIOUR_GROUP = 'Behaviour props';

const loadAsyncOptions = () => {
  return new Promise<Array<SelectableValue<string>>>(resolve => {
    setTimeout(() => {
      resolve(generateOptions());
    }, 2000);
  });
};

const getKnobs = () => {
  const disabled = boolean('Disabled', false, BEHAVIOUR_GROUP);
  const invalid = boolean('Invalid', false, BEHAVIOUR_GROUP);
  const loading = boolean('Loading', false, BEHAVIOUR_GROUP);
  const prefixSuffixOpts = {
    None: null,
    Text: '$',
    ...getAvailableIcons().reduce<Record<string, string>>((prev, c) => {
      return {
        ...prev,
        [`Icon: ${c}`]: `icon-${c}`,
      };
    }, {}),
  };
  const VISUAL_GROUP = 'Visual options';
  // ---
  const prefix = select('Prefix', prefixSuffixOpts, null, VISUAL_GROUP);
  const width = number('Width', 0, undefined, VISUAL_GROUP);

  let prefixEl: any = prefix;
  if (prefix && prefix.match(/icon-/g)) {
    prefixEl = <Icon name={prefix.replace(/icon-/g, '') as IconName} />;
  }

  return {
    width,
    disabled,
    invalid,
    loading,
    prefixEl,
  };
};

const getMultiSelectKnobs = () => {
  const isClearable = boolean('Clearable', false, BEHAVIOUR_GROUP);
  const closeMenuOnSelect = boolean('Close on Select', false, BEHAVIOUR_GROUP);
  const maxVisibleValues = number('Max. visible values', 5, undefined, BEHAVIOUR_GROUP);

  return {
    isClearable,
    closeMenuOnSelect,
    maxVisibleValues,
  };
};

const getDynamicProps = () => {
  const knobs = getKnobs();
  return {
    width: knobs.width,
    disabled: knobs.disabled,
    isLoading: knobs.loading,
    invalid: knobs.invalid,
    prefix: knobs.prefixEl,
  };
};

export const basic = () => {
  const [value, setValue] = useState<SelectableValue<string>>();

  return (
    <>
      <Select
        options={generateOptions()}
        value={value}
        onChange={v => {
          setValue(v);
        }}
        {...getDynamicProps()}
      />
    </>
  );
};

/**
 * Uses plain values instead of SelectableValue<T>
 */
export const basicSelectPlainValue = () => {
  const [value, setValue] = useState<string>();
  return (
    <>
      <Select
        options={generateOptions()}
        value={value}
        onChange={v => {
          setValue(v.value);
        }}
        {...getDynamicProps()}
      />
    </>
  );
};

/**
 * Uses plain values instead of SelectableValue<T>
 */
export const SelectWithOptionDescriptions = () => {
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
        onChange={v => {
          setValue(v.value);
        }}
        {...getDynamicProps()}
      />
    </>
  );
};

/**
 * Uses plain values instead of SelectableValue<T>
 */
export const multiPlainValue = () => {
  const [value, setValue] = useState<string[]>();

  return (
    <>
      <MultiSelect
        options={generateOptions()}
        value={value}
        onChange={v => {
          setValue(v.map((v: any) => v.value));
        }}
        {...getDynamicProps()}
      />
    </>
  );
};

export const multiSelect = () => {
  const [value, setValue] = useState<Array<SelectableValue<string>>>([]);

  return (
    <>
      <MultiSelect
        options={generateOptions()}
        value={value}
        onChange={v => {
          setValue(v);
        }}
        {...getDynamicProps()}
        {...getMultiSelectKnobs()}
      />
    </>
  );
};

export const multiSelectAsync = () => {
  const [value, setValue] = useState<Array<SelectableValue<string>>>();

  return (
    <AsyncMultiSelect
      loadOptions={loadAsyncOptions}
      defaultOptions
      value={value}
      onChange={v => {
        setValue(v);
      }}
      allowCustomValue
      {...getDynamicProps()}
    />
  );
};
export const buttonSelect = () => {
  const [value, setValue] = useState<SelectableValue<string>>();
  const icon = getIconKnob();
  return (
    <ButtonSelect
      placeholder="Select all the things..."
      value={value}
      options={generateOptions()}
      onChange={v => {
        setValue(v);
      }}
      allowCustomValue
      icon={icon}
      {...getDynamicProps()}
    />
  );
};

export const basicSelectAsync = () => {
  const [value, setValue] = useState<SelectableValue<string>>();

  return (
    <AsyncSelect
      loadOptions={loadAsyncOptions}
      defaultOptions
      value={value}
      onChange={v => {
        setValue(v);
      }}
      {...getDynamicProps()}
    />
  );
};

export const customizedControl = () => {
  const [value, setValue] = useState<SelectableValue<string>>();

  return (
    <Select
      options={generateOptions()}
      value={value}
      onChange={v => {
        setValue(v);
      }}
      renderControl={React.forwardRef(({ isOpen, value, ...otherProps }, ref) => {
        return (
          <Button {...otherProps} ref={ref}>
            {' '}
            {isOpen ? 'Open' : 'Closed'}
          </Button>
        );
      })}
      {...getDynamicProps()}
    />
  );
};

export const autoMenuPlacement = () => {
  const [value, setValue] = useState<SelectableValue<string>>();

  return (
    <>
      <div style={{ width: '100%', height: '95vh', display: 'flex', alignItems: 'flex-end' }}>
        <Select
          options={generateOptions()}
          value={value}
          onChange={v => {
            setValue(v);
          }}
          {...getDynamicProps()}
        />
      </div>
    </>
  );
};

export const customValueCreation = () => {
  const [value, setValue] = useState<SelectableValue<string>>();
  const [customOptions, setCustomOptions] = useState<Array<SelectableValue<string>>>([]);
  const options = generateOptions();
  return (
    <>
      <Select
        options={[...options, ...customOptions]}
        value={value}
        onChange={v => {
          setValue(v);
        }}
        allowCustomValue
        onCreateOption={v => {
          const customValue: SelectableValue<string> = { value: kebabCase(v), label: v };
          setCustomOptions([...customOptions, customValue]);
          setValue(customValue);
        }}
        {...getDynamicProps()}
      />
    </>
  );
};

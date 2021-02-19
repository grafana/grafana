import React, { useState } from 'react';
import { Select, AsyncSelect, MultiSelect, AsyncMultiSelect } from './Select';
import { withCenteredStory, withHorizontallyCenteredStory } from '../../../utils/storybook/withCenteredStory';
import { SelectableValue } from '@grafana/data';
import { getAvailableIcons, IconType } from '../../Icon/types';
import { select, boolean } from '@storybook/addon-knobs';
import { Icon } from '../../Icon/Icon';
import { Button } from '../Button';
import { ButtonSelect } from './ButtonSelect';
import { getIconKnob } from '../../../utils/storybook/knobs';
import kebabCase from 'lodash/kebabCase';

export default {
  title: 'Forms/Select',
  component: Select,
  decorators: [withCenteredStory, withHorizontallyCenteredStory],
};

export const generateOptions = () => {
  const values = [
    'Sharilyn Markowitz',
    'Naomi Striplin',
    'Beau Bevel',
    'Garrett Starkes',
    'Hildegarde Pedro',
    'Gudrun Seyler',
    'Eboni Raines',
    'Hye Felix',
    'Chau Brito',
    'Heidy Zook',
    'Karima Husain',
    'Virgil Mckinny',
    'Kaley Dodrill',
    'Sharan Ruf',
    'Edgar Loveland',
    'Judie Sanger',
    'Season Bundrick',
    'Ok Vicente',
    'Garry Spitz',
    'Han Harnish',
  ];

  return values.map<SelectableValue<string>>(name => ({
    value: kebabCase(name),
    label: name,
  }));
};

const loadAsyncOptions = () => {
  return new Promise<Array<SelectableValue<string>>>(resolve => {
    setTimeout(() => {
      resolve(generateOptions());
    }, 2000);
  });
};

const getKnobs = () => {
  const BEHAVIOUR_GROUP = 'Behaviour props';
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

  let prefixEl: any = prefix;
  if (prefix && prefix.match(/icon-/g)) {
    prefixEl = <Icon name={prefix.replace(/icon-/g, '') as IconType} />;
  }

  return {
    disabled,
    invalid,
    loading,
    prefixEl,
  };
};

const getDynamicProps = () => {
  const knobs = getKnobs();
  return {
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
        size="md"
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
        size="md"
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
        size="md"
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
        size="md"
        {...getDynamicProps()}
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
      size="md"
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
      size="md"
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
      size="md"
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
      size="md"
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
      <div style={{ height: '95vh', display: 'flex', alignItems: 'flex-end' }}>
        <Select
          options={generateOptions()}
          value={value}
          onChange={v => {
            setValue(v);
          }}
          size="md"
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
        size="md"
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

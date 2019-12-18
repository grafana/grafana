import React, { useState } from 'react';
import { Select, AsyncSelect } from './Select';
import { withCenteredStory, withHorizontallyCenteredStory } from '../../../utils/storybook/withCenteredStory';
import { SelectableValue } from '@grafana/data';
import { getAvailableIcons, IconType } from '../../Icon/types';
import { select, boolean } from '@storybook/addon-knobs';
import { Icon } from '../../Icon/Icon';
import { Button } from '../Button';
import { ButtonSelect } from './ButtonSelect';
import { getIconKnob } from '../../../utils/storybook/knobs';

export default {
  title: 'UI/Forms/Select',
  component: Select,
  decorators: [withCenteredStory, withHorizontallyCenteredStory],
  // parameters: {
  //   docs: {
  //     page: mdx,
  //   },
  // },
};

const options: Array<SelectableValue<string>> = [
  {
    label: 'Prometheus is a veeeeeeeeeeeeeery long value',
    value: 'prometheus',
  },
  {
    label: 'Graphite',
    value: 'graphite',
  },
  {
    label: 'InlufxDB',
    value: 'inlufxdb',
  },
];

const loadAsyncOptions = () => {
  return new Promise<Array<SelectableValue<string>>>(resolve => {
    setTimeout(() => {
      resolve(options);
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
        options={options}
        value={value}
        onChange={v => {
          setValue(v);
        }}
        size="md"
        allowCustomValue
        {...getDynamicProps()}
      />
    </>
  );
};

export const buttonSelect = () => {
  const [value, setValue] = useState<SelectableValue<string>>();
  const icon = getIconKnob();
  return (
    <ButtonSelect
      placeholder="Select all the things..."
      value={value}
      options={options}
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

export const async = () => {
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
      allowCustomValue
      {...getDynamicProps()}
    />
  );
};

export const customControl = () => {
  const [value, setValue] = useState<SelectableValue<string>>();

  return (
    <Select
      options={options}
      value={value}
      onChange={v => {
        setValue(v);
      }}
      size="md"
      allowCustomValue
      renderControl={({ isOpen, value, ...otherProps }) => {
        return <Button {...otherProps}> {isOpen ? 'Open' : 'Closed'}</Button>;
      }}
      {...getDynamicProps()}
    />
  );
};

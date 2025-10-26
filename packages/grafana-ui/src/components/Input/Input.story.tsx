import { StoryFn, Meta } from '@storybook/react';
import { useId, useState } from 'react';

import { KeyValue } from '@grafana/data';

import { getAvailableIcons } from '../../types/icon';
import { Button } from '../Button/Button';
import { Field } from '../Forms/Field';

import { Input } from './Input';
import mdx from './Input.mdx';
import { parseAccessory } from './storyUtils';

const prefixSuffixOpts = {
  $: 'Text',
  ...getAvailableIcons().reduce<KeyValue<string>>((prev, c) => {
    return {
      ...prev,
      [`icon-${c}`]: `Icon: ${c}`,
    };
  }, {}),
};

const meta: Meta = {
  title: 'Inputs/Input',
  component: Input,
  parameters: {
    docs: {
      page: mdx,
    },
    controls: {
      exclude: ['prefix', 'suffix', 'addonBefore', 'addonAfter'],
    },
  },
  args: {
    type: 'text',
    width: 40,
    prefixVisible: '',
    suffixVisible: '',
    invalid: false,
    loading: false,
  },
  argTypes: {
    prefixVisible: {
      control: {
        type: 'select',
        labels: prefixSuffixOpts,
      },
      options: [null, ...Object.keys(prefixSuffixOpts)],
    },
    suffixVisible: {
      control: {
        type: 'select',
        labels: prefixSuffixOpts,
      },
      options: [null, ...Object.keys(prefixSuffixOpts)],
    },
    type: {
      control: {
        type: 'select',
      },
      options: ['text', 'number', 'password'],
    },
    // validation: { name: 'Validation regex (will do a partial match if you do not anchor it)' },
    width: { control: { type: 'range', min: 10, max: 200, step: 10 } },
  },
};

export const Simple: StoryFn = (args) => {
  const addonAfter = <Button variant="secondary">Load</Button>;
  const addonBefore = <div style={{ display: 'flex', alignItems: 'center', padding: '5px' }}>Input</div>;
  const prefix = parseAccessory(args.prefixVisible);
  const suffix = parseAccessory(args.suffixVisible);
  const id = useId();

  return (
    <Field label="Simple input">
      <Input
        id={id}
        disabled={args.disabled}
        width={args.width}
        prefix={prefix}
        invalid={args.invalid}
        suffix={suffix}
        loading={args.loading}
        addonBefore={args.before && addonBefore}
        addonAfter={args.after && addonAfter}
        type={args.type}
        placeholder={args.placeholder}
      />
    </Field>
  );
};
Simple.args = {
  disabled: false,
  before: false,
  after: false,
  placeholder: 'Enter your name here...',
};

export const WithFieldValidation: StoryFn = (args) => {
  const [value, setValue] = useState('');
  const id = useId();

  return (
    <div>
      <Field invalid={value === ''} error={value === '' ? 'This input is required' : ''} label="Input with validation">
        <Input id={id} value={value} onChange={(e) => setValue(e.currentTarget.value)} {...args} />
      </Field>
    </div>
  );
};

export default meta;

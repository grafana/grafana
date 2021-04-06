import React, { useState } from 'react';
import { Story } from '@storybook/react';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import mdx from './Input.mdx';
import { getAvailableIcons, IconName } from '../../types';
import { KeyValue } from '@grafana/data';
import { Field, Icon, Button, Input } from '@grafana/ui';
import { NOOP_CONTROL } from '../../utils/storybook/noopControl';

const prefixSuffixOpts = {
  None: null,
  Text: '$',
  ...getAvailableIcons().reduce<KeyValue<string>>((prev, c) => {
    return {
      ...prev,
      [`Icon: ${c}`]: `icon-${c}`,
    };
  }, {}),
};

export default {
  title: 'Forms/Input',
  component: Input,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
    knobs: {
      disable: true,
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
        options: prefixSuffixOpts,
      },
    },
    suffixVisible: {
      control: {
        type: 'select',
        options: prefixSuffixOpts,
      },
    },
    type: {
      control: {
        type: 'select',
        options: ['text', 'number', 'password'],
      },
    },
    // validation: { name: 'Validation regex (will do a partial match if you do not anchor it)' },
    width: { control: { type: 'range', min: 10, max: 200, step: 10 } },
    prefix: NOOP_CONTROL,
    suffix: NOOP_CONTROL,
    addonBefore: NOOP_CONTROL,
    addonAfter: NOOP_CONTROL,
  },
};

export const Simple: Story = (args) => {
  const addonAfter = <Button variant="secondary">Load</Button>;
  const addonBefore = <div style={{ display: 'flex', alignItems: 'center', padding: '5px' }}>Input</div>;
  let prefixEl: any = args.prefixVisible;
  if (args.prefixVisible && args.prefixVisible.match(/icon-/g)) {
    prefixEl = <Icon name={args.suffixVisible.replace(/icon-/g, '') as IconName} />;
  }
  let suffixEl: any = args.suffixVisible;
  if (args.suffixVisible && args.suffixVisible.match(/icon-/g)) {
    suffixEl = <Icon name={args.suffixVisible.replace(/icon-/g, '') as IconName} />;
  }

  return (
    <Input
      disabled={args.disabled}
      width={args.width}
      prefix={prefixEl}
      invalid={args.invalid}
      suffix={suffixEl}
      loading={args.loading}
      addonBefore={args.before && addonBefore}
      addonAfter={args.after && addonAfter}
      type={args.type}
      placeholder={args.placeholder}
    />
  );
};
Simple.args = {
  disabled: false,
  before: false,
  after: false,
  placeholder: 'Enter your name here...',
};

export const WithFieldValidation: Story = (args) => {
  const [value, setValue] = useState('');

  return (
    <div>
      <Field invalid={value === ''} error={value === '' ? 'This input is required' : ''}>
        <Input value={value} onChange={(e) => setValue(e.currentTarget.value)} {...args} />
      </Field>
    </div>
  );
};

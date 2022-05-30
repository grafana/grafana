import { Story, Meta } from '@storybook/react';
import React from 'react';

import { KeyValue } from '@grafana/data';
import { Icon, Button, AutoSizeInput } from '@grafana/ui';

import { getAvailableIcons, IconName } from '../../types';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';

import mdx from './AutoSizeInput.mdx';

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
  title: 'Forms/Input/AutoSizeInput',
  component: AutoSizeInput,
  decorators: [withCenteredStory],
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
    minWidth: { control: { type: 'range', min: 10, max: 200, step: 10 } },
  },
} as Meta;

export const Simple: Story = (args) => {
  const addonAfter = <Button variant="secondary">Load</Button>;
  const addonBefore = <div style={{ display: 'flex', alignItems: 'center', padding: '5px' }}>AutoSizeInput</div>;
  const prefix = args.prefixVisible;
  const suffix = args.suffixVisible;
  let prefixEl: any = prefix;
  if (prefix && prefix.match(/icon-/g)) {
    prefixEl = <Icon name={prefix.replace(/icon-/g, '') as IconName} />;
  }
  let suffixEl: any = suffix;
  if (suffix && suffix.match(/icon-/g)) {
    suffixEl = <Icon name={suffix.replace(/icon-/g, '') as IconName} />;
  }

  return (
    <AutoSizeInput
      disabled={args.disabled}
      prefix={prefixEl}
      invalid={args.invalid}
      width={args.width}
      suffix={suffixEl}
      loading={args.loading}
      addonBefore={args.before && addonBefore}
      addonAfter={args.after && addonAfter}
      type={args.type}
      placeholder={args.placeholder}
      minWidth={args.minWidth}
    />
  );
};
Simple.args = {
  disabled: false,
  before: false,
  after: false,
  placeholder: 'Enter your name here...',
};

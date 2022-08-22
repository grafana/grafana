import { Story, Meta } from '@storybook/react';
import React from 'react';

import { Icon, Button, AutoSizeInput } from '@grafana/ui';

import { IconName } from '../../types';
import { iconOptions } from '../../utils/storybook/knobs';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';

import mdx from './AutoSizeInput.mdx';

const icons: { [key: string]: string | undefined } = { ...iconOptions };
Object.keys(icons).forEach((key) => {
  icons[key] = `icon-${icons[key]}`;
});

const prefixSuffixOpts = {
  Text: '$',
  ...icons,
};

const meta: Meta = {
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
};

export const Simple: Story = (args) => {
  const addonAfter = <Button variant="secondary">Load</Button>;
  const addonBefore = <div style={{ display: 'flex', alignItems: 'center', padding: '5px' }}>AutoSizeInput</div>;
  const prefix = args.prefixVisible;
  const suffix = args.suffixVisible;
  let prefixEl = prefix;
  if (prefix && prefix.match(/icon-/g)) {
    prefixEl = <Icon name={prefix.replace(/icon-/g, '') as IconName} />;
  }
  let suffixEl = suffix;
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

export default meta;

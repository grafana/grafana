import { Story, Meta } from '@storybook/react';
import React from 'react';

import { Button, AutoSizeInput } from '@grafana/ui';

import { iconOptions } from '../../utils/storybook/knobs';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';

import mdx from './AutoSizeInput.mdx';
import { parseAccessory } from './storyUtils';

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
  const prefix = parseAccessory(args.prefixVisible);
  const suffix = parseAccessory(args.suffixVisible);

  return (
    <AutoSizeInput
      disabled={args.disabled}
      prefix={prefix}
      invalid={args.invalid}
      width={args.width}
      suffix={suffix}
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

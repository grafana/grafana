import { Story, Meta } from '@storybook/react';
import React from 'react';

import { AutoSaveInput } from '@grafana/ui';

import { withCenteredStory } from '../../utils/storybook/withCenteredStory';

import mdx from './Input.mdx';
// import parseAccessory } from './storyUtils';

const meta: Meta = {
  title: 'AutoSaveInput',
  component: AutoSaveInput,
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
    onFinishChange: () => console.log('Done'),
  },
  // argTypes: {
  //   prefixVisible: {
  //     control: {
  //       type: 'select',
  //       options: prefixSuffixOpts,
  //     },
  //   },
  //   suffixVisible: {
  //     control: {
  //       type: 'select',
  //       options: prefixSuffixOpts,
  //     },
  //   },
  //   type: {
  //     control: {
  //       type: 'select',
  //       options: ['text', 'number', 'password'],
  //     },
  //   },
  // validation: { name: 'Validation regex (will do a partial match if you do not anchor it)' },
  //width: { control: { type: 'range', min: 10, max: 200, step: 10 } },
  // },
};

export const Simple: Story = (args) => {
  //  const prefix = parseAccessory(args.prefixVisible);
  //  const suffix = parseAccessory(args.suffixVisible);

  return <AutoSaveInput onFinishChange={args.onFinishChange} />;
};
Simple.args = {
  disabled: false,
  before: false,
  after: false,
  placeholder: 'Enter your name here...',
};

export default meta;

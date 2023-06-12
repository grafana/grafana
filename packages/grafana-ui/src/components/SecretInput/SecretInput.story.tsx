import { StoryFn, Meta } from '@storybook/react';
import React, { useState, ChangeEvent } from 'react';

import { withCenteredStory } from '../../utils/storybook/withCenteredStory';

import { SecretInput } from './SecretInput';
import mdx from './SecretInput.mdx';

const meta: Meta<typeof SecretInput> = {
  title: 'Forms/SecretInput',
  component: SecretInput,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
    controls: {
      exclude: [
        'prefix',
        'suffix',
        'addonBefore',
        'addonAfter',
        'type',
        'disabled',
        'invalid',
        'loading',
        'before',
        'after',
      ],
    },
  },
  args: {
    width: 50,
    placeholder: 'Enter your secret...',
  },
  argTypes: {
    width: { control: { type: 'range', min: 10, max: 200, step: 10 } },
  },
};

export default meta;

const Template: StoryFn<typeof SecretInput> = (args) => {
  const [secret, setSecret] = useState('');

  return (
    <SecretInput
      width={args.width}
      value={secret}
      isConfigured={args.isConfigured}
      placeholder={args.placeholder}
      onChange={(event: ChangeEvent<HTMLInputElement>) => setSecret(event.target.value.trim())}
      onReset={() => setSecret('')}
    />
  );
};

export const basic = Template.bind({});

basic.args = {
  isConfigured: false,
};

export const secretIsConfigured = Template.bind({});

secretIsConfigured.args = {
  isConfigured: true,
};

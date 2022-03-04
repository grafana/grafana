import React, { useState, ChangeEvent } from 'react';
import { Story, Meta } from '@storybook/react';
import { SecretInput, Props } from './SecretInput';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';

export default {
  title: 'Forms/SecretInput',
  component: SecretInput,
  decorators: [withCenteredStory],
  parameters: {
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
} as Meta;

const Template: Story<Props> = (args) => {
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

import { action } from '@storybook/addon-actions';
import { useArgs } from '@storybook/client-api';
import { Meta, StoryFn } from '@storybook/react';
import React from 'react';

import { withCenteredStory } from '../../utils/storybook/withCenteredStory';

import { SecretFormField } from './SecretFormField';

const meta: Meta<typeof SecretFormField> = {
  title: 'Forms/SecretFormField',
  component: SecretFormField,
  decorators: [withCenteredStory],
  parameters: {
    controls: {
      exclude: ['onChange', 'onReset'],
    },
  },
  argTypes: {
    labelWidth: { control: { type: 'range', min: 0, max: 30 } },
    inputWidth: { control: { type: 'range', min: 0, max: 30 } },
    tooltip: { control: { type: 'text' } },
  },
  args: {
    isConfigured: false,
    inputWidth: 12,
    label: 'Secret field',
    labelWidth: 10,
    placeholder: 'Password',
    tooltip: 'this is a tooltip',
    value: 'mySuperSecretPassword',
  },
};

export const Basic: StoryFn<typeof SecretFormField> = (args) => {
  const [, updateArgs] = useArgs();
  return (
    <SecretFormField
      {...args}
      onChange={(e) => {
        action('onChange')(e);
        updateArgs({ value: e.currentTarget.value });
      }}
      onReset={() => {
        action('onReset')('');
        updateArgs({ value: '' });
      }}
    />
  );
};

export default meta;

import React from 'react';
import { action } from '@storybook/addon-actions';
import { Meta, Story } from '@storybook/react';

import { SecretFormField, Props } from './SecretFormField';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { UseState } from '../../utils/storybook/UseState';

export default {
  title: 'Forms/SecretFormField',
  component: SecretFormField,
  decorators: [withCenteredStory],
  parameters: {
    controls: {
      exclude: ['onReset'],
    },
  },
  argTypes: {
    labelWidth: { control: { type: 'range', min: 0, max: 30 } },
    inputWidth: { control: { type: 'range', min: 0, max: 30 } },
    tooltip: { control: { type: 'text' } },
  },
} as Meta;

export const Basic: Story<Props> = (args) => {
  return (
    <UseState initialState="Input value">
      {(value, setValue) => (
        <SecretFormField
          label={args.label}
          labelWidth={args.labelWidth}
          value={value}
          isConfigured={args.isConfigured}
          onChange={(e) => setValue(e.currentTarget.value)}
          onReset={() => {
            action('Value was reset')('');
            setValue('');
          }}
          inputWidth={args.inputWidth}
          tooltip={args.tooltip}
          placeholder={args.placeholder}
        />
      )}
    </UseState>
  );
};
Basic.args = {
  label: 'Secret field',
  labelWidth: 10,
  isConfigured: false,
  inputWidth: 12,
  tooltip: 'this is a tooltip',
  placeholder: 'Password',
};

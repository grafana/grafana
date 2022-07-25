import { action } from '@storybook/addon-actions';
import { ComponentMeta, ComponentStory } from '@storybook/react';
import React from 'react';

import { UseState } from '../../utils/storybook/UseState';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';

import { SecretFormField } from './SecretFormField';

const meta: ComponentMeta<typeof SecretFormField> = {
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
};

export const Basic: ComponentStory<typeof SecretFormField> = (args) => {
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

export default meta;

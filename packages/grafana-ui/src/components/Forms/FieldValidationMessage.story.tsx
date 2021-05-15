import React from 'react';
import { Story } from '@storybook/react';
import { FieldValidationMessage, FieldValidationMessageProps } from './FieldValidationMessage';
import mdx from './FieldValidationMessage.mdx';
import { NOOP_CONTROL } from '../../utils/storybook/noopControl';

export default {
  title: 'Forms/FieldValidationMessage',
  component: FieldValidationMessage,
  parameters: {
    docs: {
      page: mdx,
    },
    knobs: {
      disable: true,
    },
  },
  args: {
    horizontal: false,
    children: 'Invalid input message',
  },
  argTypes: {
    children: { name: 'message' },
    className: NOOP_CONTROL,
  },
};

export const Basic: Story<FieldValidationMessageProps> = (args) => {
  return <FieldValidationMessage horizontal={args.horizontal}>{args.children}</FieldValidationMessage>;
};

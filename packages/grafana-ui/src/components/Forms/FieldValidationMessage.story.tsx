import React from 'react';
import { Meta, Story } from '@storybook/react';
import { FieldValidationMessage, FieldValidationMessageProps } from './FieldValidationMessage';
import mdx from './FieldValidationMessage.mdx';
import { FieldInfoMessage } from './FieldInfoMessage';

export default {
  title: 'Forms/FieldValidationMessage',
  component: FieldValidationMessage,
  parameters: {
    docs: {
      page: mdx,
    },
    controls: {
      exclude: ['className'],
    },
  },
  args: {
    horizontal: false,
    children: 'Invalid input message',
  },
  argTypes: {
    children: { name: 'message' },
  },
} as Meta;

export const Basic: Story<FieldValidationMessageProps> = (args) => {
  return <FieldValidationMessage horizontal={args.horizontal}>{args.children}</FieldValidationMessage>;
};

export const InfoMessage: Story<FieldValidationMessageProps> = (args) => {
  return <FieldInfoMessage horizontal={args.horizontal}>{args.children}</FieldInfoMessage>;
};

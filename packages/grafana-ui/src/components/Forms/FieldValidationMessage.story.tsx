import React from 'react';
import { Meta, Story } from '@storybook/react';
import { FieldValidationMessage } from './FieldValidationMessage';
import mdx from './FieldValidationMessage.mdx';

const story = {
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
};

export default story as Meta;

type Args = typeof story['args'];

export const Basic: Story<Args> = (args) => {
  return <FieldValidationMessage horizontal={args.horizontal}>{args.children}</FieldValidationMessage>;
};

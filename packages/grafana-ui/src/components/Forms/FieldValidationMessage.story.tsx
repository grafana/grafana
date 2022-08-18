import { ComponentMeta, ComponentStory } from '@storybook/react';
import React from 'react';

import { FieldValidationMessage } from './FieldValidationMessage';
import mdx from './FieldValidationMessage.mdx';

const meta: ComponentMeta<typeof FieldValidationMessage> = {
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

export const Basic: ComponentStory<typeof FieldValidationMessage> = (args) => {
  return <FieldValidationMessage horizontal={args.horizontal}>{args.children}</FieldValidationMessage>;
};

export default meta;

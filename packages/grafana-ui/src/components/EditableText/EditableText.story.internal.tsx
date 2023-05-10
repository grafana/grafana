import { action } from '@storybook/addon-actions';
import { useArgs } from '@storybook/client-api';
import { Meta, Story } from '@storybook/react';
import React from 'react';

import { EditableText } from './EditableText';
import mdx from './EditableText.mdx';

const meta: Meta = {
  title: 'General/Text/EditableText',
  component: EditableText,
  parameters: {
    docs: {
      page: mdx,
    },
  },
  argTypes: {
    variant: { control: 'select', options: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'body', 'bodySmall', undefined] },
    weight: {
      control: 'select',
      options: ['bold', 'medium', 'light', 'regular', undefined],
    },
    color: {
      control: 'select',
      options: [
        'error',
        'success',
        'warning',
        'info',
        'primary',
        'secondary',
        'disabled',
        'link',
        'maxContrast',
        undefined,
      ],
    },
    truncate: { control: 'boolean' },
    textAlignment: {
      control: 'select',
      options: ['inherit', 'initial', 'left', 'right', 'center', 'justify', undefined],
    },
  },
};

export const Basic: Story = (args) => {
  const [, updateArgs] = useArgs();
  return (
    <EditableText
      {...args}
      as={args.as}
      editLabel={args.editLabel}
      onEdit={(newValue) => {
        return new Promise<void>((resolve) => {
          setTimeout(() => {
            action('onEdit resolved')(newValue);
            resolve();
            updateArgs({ children: newValue });
          }, 1000);
        });
      }}
    >
      {args.children}
    </EditableText>
  );
};
Basic.args = {
  as: 'span',
  editLabel: 'Edit this text',
  variant: undefined,
  weight: 'light',
  textAlignment: 'center',
  color: 'primary',
  children: 'This is a H1 component',
};

export default meta;

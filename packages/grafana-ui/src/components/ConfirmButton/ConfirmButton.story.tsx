import React from 'react';
import { Meta, Story } from '@storybook/react';
import { ConfirmButton } from '@grafana/ui';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { action } from '@storybook/addon-actions';
import { Button } from '../Button';
import { DeleteButton } from './DeleteButton';
import { Props } from './ConfirmButton';
import mdx from './ConfirmButton.mdx';

export default {
  title: 'Buttons/ConfirmButton',
  component: ConfirmButton,
  decorators: [withCenteredStory],
  subcomponents: { DeleteButton },
  parameters: {
    docs: {
      page: mdx,
    },
    controls: {
      exclude: ['className'],
    },
  },
  args: {
    buttonText: 'Edit',
    confirmText: 'Save',
    size: 'md',
    confirmVariant: 'primary',
    disabled: false,
    closeOnConfirm: true,
  },
  argTypes: {
    confirmVariant: {
      control: {
        type: 'select',
      },
      options: ['primary', 'secondary', 'destructive', 'link'],
    },
    size: { control: { type: 'select' }, options: ['xs', 'sm', 'md', 'lg'] },
  },
} as Meta;

interface StoryProps extends Partial<Props> {
  buttonText: string;
}

export const Basic: Story<StoryProps> = (args) => {
  return (
    <ConfirmButton
      closeOnConfirm={args.closeOnConfirm}
      size={args.size}
      confirmText={args.confirmText}
      disabled={args.disabled}
      confirmVariant={args.confirmVariant}
      onConfirm={() => {
        action('Saved')('save!');
      }}
    >
      {args.buttonText}
    </ConfirmButton>
  );
};

export const WithCustomButton: Story<StoryProps> = (args) => {
  return (
    <ConfirmButton
      closeOnConfirm={args.closeOnConfirm}
      size={args.size}
      confirmText={args.confirmText}
      disabled={args.disabled}
      confirmVariant={args.confirmVariant}
      onConfirm={() => {
        action('Saved')('save!');
      }}
    >
      <Button size={args.size} variant="secondary" icon="pen">
        {args.buttonText}
      </Button>
    </ConfirmButton>
  );
};

export const Delete: Story<StoryProps> = (args) => {
  return (
    <DeleteButton
      size={args.size}
      disabled={args.disabled}
      onConfirm={() => {
        action('Deleted')('delete!');
      }}
    />
  );
};

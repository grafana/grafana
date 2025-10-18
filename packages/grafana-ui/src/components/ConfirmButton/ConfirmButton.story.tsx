import { action } from '@storybook/addon-actions';
import { Meta, StoryFn } from '@storybook/react';

import { Button } from '../Button/Button';

import { ConfirmButton, Props } from './ConfirmButton';
import mdx from './ConfirmButton.mdx';
import { DeleteButton } from './DeleteButton';

const meta: Meta = {
  title: 'Inputs/ConfirmButton',
  component: ConfirmButton,
  // SB7 has broken subcomponent types due to dropping support for the feature
  // https://github.com/storybookjs/storybook/issues/20782
  // @ts-ignore
  subcomponents: { DeleteButton },
  parameters: {
    docs: {
      page: mdx,
    },
    controls: {
      exclude: ['className', 'onClick', 'onCancel', 'onConfirm'],
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
};

interface StoryProps extends Partial<Props> {
  buttonText: string;
}

export const Basic: StoryFn<StoryProps> = (args) => {
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

export const WithCustomButton: StoryFn<StoryProps> = (args) => {
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

export const Delete: StoryFn<StoryProps> = (args) => {
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

export default meta;

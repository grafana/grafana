import React from 'react';
import { Story } from '@storybook/react';
import { Button, ButtonProps } from './Button';
import { withCenteredStory, withHorizontallyCenteredStory } from '../../utils/storybook/withCenteredStory';
import { iconOptions } from '../../utils/storybook/knobs';
import mdx from './Button.mdx';

export default {
  title: 'Buttons/Button',
  component: Button,
  decorators: [withCenteredStory, withHorizontallyCenteredStory],
  argTypes: {
    variant: { control: { type: 'select', options: ['primary', 'secondary', 'destructive', 'link'] } },
    size: { control: { type: 'select', options: ['sm', 'md', 'lg'] } },
    icon: { control: { type: 'select', options: iconOptions } },
    css: { control: { disable: true } },
    className: { control: { disable: true } },
  },
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

export const Simple: Story<ButtonProps> = ({ disabled, icon, children, size, variant }) => {
  return (
    <Button variant={variant} size={size} icon={icon} disabled={disabled}>
      {children}
    </Button>
  );
};

Simple.args = {
  variant: 'primary',
  size: 'md',
  disabled: false,
  children: 'Button',
  icon: undefined,
};

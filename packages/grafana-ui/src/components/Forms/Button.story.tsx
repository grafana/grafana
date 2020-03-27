import React from 'react';
import { select, text } from '@storybook/addon-knobs';
import { Button, ButtonVariant } from './Button';
import { withCenteredStory, withHorizontallyCenteredStory } from '../../utils/storybook/withCenteredStory';
import { getIconKnob } from '../../utils/storybook/knobs';
import { ComponentSize } from '../../types/size';
import mdx from './Button.mdx';

export default {
  title: 'Forms/Button',
  component: Button,
  decorators: [withCenteredStory, withHorizontallyCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

const variants = ['primary', 'secondary', 'destructive', 'link'];

const sizes = ['sm', 'md', 'lg'];

export const simple = () => {
  const variant = select('Variant', variants, 'primary');
  const size = select('Size', sizes, 'md');
  const buttonText = text('text', 'Button');
  const icon = getIconKnob();

  return (
    <Button variant={variant as ButtonVariant} size={size as ComponentSize} icon={icon && `fa fa-${icon}`}>
      {buttonText}
    </Button>
  );
};

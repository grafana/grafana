import React from 'react';
import { select, text } from '@storybook/addon-knobs';
import { Button, ButtonVariant } from './Button';
import { withCenteredStory, withHorizontallyCenteredStory } from '../../utils/storybook/withCenteredStory';
import { getIconKnob } from '../../utils/storybook/knobs';
import mdx from './Button.mdx';
import { ComponentSize } from '../../types/size';

export default {
  title: 'Buttons/Button',
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
    <Button variant={variant as ButtonVariant} size={size as ComponentSize} icon={icon}>
      {buttonText}
    </Button>
  );
};

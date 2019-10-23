import React from 'react';
import { Button } from './Button';
import { withCenteredStory, withHorizontallyCenteredStory } from '../../utils/storybook/withCenteredStory';
import { select, text } from '@storybook/addon-knobs';
import { ThemeContext } from '../../themes';
import { ButtonSize, ButtonVariant } from '../..';
import mdx from './Button.mdx';

export default {
  title: 'UI/Forms/Button',
  component: Button,
  decorators: [withCenteredStory, withHorizontallyCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

const variants = ['primary', 'secondary', 'destructive'];

const sizes = ['sm', 'md', 'lg'];

export const simple = () => {
  const variant = select('Variant', variants, 'primary');
  const size = select('Size', sizes, 'md');
  const buttonText = text('text', 'Button');

  return (
    <ThemeContext.Consumer>
      {theme => {
        return (
          <Button theme={theme} variant={variant as ButtonVariant} size={size as ButtonSize} renderAs="button">
            {buttonText}
          </Button>
        );
      }}
    </ThemeContext.Consumer>
  );
};

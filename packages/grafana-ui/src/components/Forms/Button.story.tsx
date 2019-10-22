import React from 'react';
import { Button } from './Button';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { select } from '@storybook/addon-knobs';
import mdx from './Button.mdx';
import { ButtonVariant } from '..';
import { ButtonSize } from '../Button/AbstractButton';

export default {
  title: 'UI/Forms/Button',
  component: Button,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

const variants = [
  'primary',
  'secondary',
  'danger',
  'inverse',
  'transparent',
  'primary-ng',
  'secondary-ng',
  'destructive-ng',
];

const sizes = ['sm', 'md', 'lg', 'sm-ng', 'md-ng', 'lg-ng'];

export const simple = () => {
  const variant = select('Variant', variants, 'primary');
  const size = select('Size', sizes, 'md');

  return (
    <Button variant={variant as ButtonVariant} size={size as ButtonSize}>
      {`${variant.substring(0, 1).toUpperCase()}${variant.substring(1, variant.length)}`}
    </Button>
  );
};

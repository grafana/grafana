import { Meta, StoryFn } from '@storybook/react';
import React from 'react';

import { StoryExample } from '../../utils/storybook/StoryExample';
import { VerticalGroup } from '../Layout/Layout';

import { TextLink } from './TextLink';
import mdx from './TextLink.mdx';

const meta: Meta = {
  title: 'General/TextLink',
  component: TextLink,
  parameters: {
    docs: {
      page: mdx,
    },
    controls: { exclude: ['href'] },
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
    externalLink: { control: 'boolean' },
    inline: { control: 'boolean' },
  },
};

export const Example: StoryFn = () => {
  return (
    <VerticalGroup>
      <StoryExample name="">
        <TextLink href="/">Go to home</TextLink>
      </StoryExample>
    </VerticalGroup>
  );
};
Example.parameters = {
  controls: {
    exclude: ['variant', 'weight', 'textAlignment', 'truncate', 'color', 'children'],
  },
};

export const Basic: StoryFn = (args) => {
  return (
    <div>
      <TextLink href="https://google.es" icon="external-link-alt" {...args}>
        This is an external link
      </TextLink>
      <TextLink href="/" {...args}>
        This is an internal link
      </TextLink>
    </div>
  );
};

Basic.args = {
  variant: 'span',
  weight: 'light',
  color: undefined,
  inline: true,
};

export default meta;

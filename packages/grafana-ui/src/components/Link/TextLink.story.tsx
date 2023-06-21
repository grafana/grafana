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
    controls: { exclude: ['href', 'external'] },
  },
  argTypes: {
    variant: { control: 'select', options: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'body', 'bodySmall', undefined] },
    weight: {
      control: 'select',
      options: ['bold', 'medium', 'light', 'regular', undefined],
    },
    color: {
      control: 'select',
      options: ['primary', 'secondary', 'disabled', 'link', 'maxContrast', undefined],
    },
    inline: { control: 'boolean' },
  },
};

export const Example: StoryFn = () => {
  return (
    <VerticalGroup>
      <StoryExample name="">
        <TextLink href="https://google.es" icon="external-link-alt" external>
          This is an external link
        </TextLink>
      </StoryExample>
    </VerticalGroup>
  );
};

Example.parameters = {
  controls: {
    exclude: ['variant', 'weight', 'truncate', 'color', 'children'],
  },
};
export const Basic: StoryFn = (args) => {
  return (
    <div>
      <TextLink href={args.href} {...args}>
        Go to Google
      </TextLink>
    </div>
  );
};
Basic.args = {
  variant: 'bodySmall',
  weight: 'light',
  color: undefined,
  inline: false,
  href: 'https://www.google.com',
  external: true,
  icon: 'external-link-alt',
};

export default meta;

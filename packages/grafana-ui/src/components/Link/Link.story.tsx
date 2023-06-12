import { Meta, StoryFn } from '@storybook/react';
import React from 'react';

import { StoryExample } from '../../utils/storybook/StoryExample';
import { VerticalGroup } from '../Layout/Layout';

import { Link } from './Link';
import mdx from './Link.mdx';

const meta: Meta = {
  title: 'General/Link',
  component: Link,
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
    inline: { control: 'boolean' },
  },
};

export const Example: StoryFn = () => {
  return (
    <VerticalGroup>
      <StoryExample name="">
        <Link href="https://google.es" icon="external-link-alt" external>
          This is an external link
        </Link>
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
      <Link href={args.href} {...args}>
        Go to Google
      </Link>
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

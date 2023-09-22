import { Meta, StoryFn } from '@storybook/react';
import React from 'react';

import { StoryExample } from '../../utils/storybook/StoryExample';
import { VerticalGroup } from '../Layout/Layout';
import { Text } from '../Text/Text';

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
  args: {
    variant: 'body',
    weight: 'light',
    color: undefined,
    inline: false,
    href: 'https://www.google.com',
    external: true,
    icon: 'external-link-alt',
  },
};

export const Example: StoryFn = (args) => {
  return (
    <VerticalGroup>
      <StoryExample name="This is a 'inline + external' link with the default behaviour">
        <Text element="p">
          To get started with a forever free Grafana Cloud account, sign up at &#160;
          <TextLink href="https://grafana.com/" {...args} inline>
            grafana.com
          </TextLink>
          .
        </Text>
      </StoryExample>
      <StoryExample name="This is a 'standalone + external' link with the default behaviour">
        <TextLink href="https://grafana.com/docs/grafana/latest/" {...args}>
          Learn how in the docs
        </TextLink>
      </StoryExample>
      <hr />
      <Text element="p">
        *The examples cannot contemplate an internal link due to conflicts between Storybook and React Router
      </Text>
    </VerticalGroup>
  );
};

Example.parameters = {
  controls: { exclude: ['href', 'external', 'variant', 'weight', 'color', 'inline', 'icon'] },
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

export default meta;

import { Meta, Story } from '@storybook/react';
import React from 'react';

import { StoryExample } from '../../utils/storybook/StoryExample';
import { VerticalGroup } from '../Layout/Layout';

import { Text } from './Text';
import mdx from './Text.mdx';

const meta: Meta = {
  title: 'General/Text',
  component: Text,
  parameters: {
    docs: {
      page: mdx,
    },
  },
  argTypes: {
    as: { control: 'select', options: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'p', 'legend'] },
    variant: { control: 'select', options: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'p', 'legend'] },
    weight: {
      control: 'select',
      options: ['bold', 'medium', 'light', 'regular'],
    },
    color: {
      control: 'select',
      options: ['error', 'success', 'warning', 'info', 'primary', 'secondary', 'disabled', 'link', 'maxContrast'],
    },
    truncate: { control: 'boolean' },
    textAlignment: { control: 'select', options: ['inherit', 'initial', 'left', 'right', 'center', 'justify'] },
    margin: { control: 'text' },
  },
};

export const Example: Story = () => {
  return (
    <VerticalGroup>
      <StoryExample name="Native header elements (global styles)">
        <h1>h1. Heading</h1>
        <h2>h2. Heading</h2>
        <h3>h3. Heading</h3>
        <h4>h4. Heading</h4>
        <h5>h5. Heading</h5>
        <h6>h6. Heading</h6>
      </StoryExample>
    </VerticalGroup>
  );
};

export const Basic: Story = (args) => {
  return (
    <div style={{ width: '300px' }}>
      <Text
        as={args.as}
        variant={args.variant}
        weight={args.weight}
        textAlignment={args.textAlignment}
        margin={args.margin}
        {...args}
      >
        {args.children}
      </Text>
    </div>
  );
};

Basic.args = {
  variant: undefined,
  as: 'h1',
  weight: 'fontWeightBold',
  textAlignment: 'center',
  truncate: false,
  color: 'color.error.text',
  children: 'This is a text component',
  margin: '100px auto',
};

export default meta;

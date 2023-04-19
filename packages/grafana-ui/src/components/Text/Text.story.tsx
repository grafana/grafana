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
      options: ['fontWeightBold', 'fontWeightMedium', 'fontWeightLight', 'fontWeightRegular'],
    },
    color: {
      control: 'select',
      options: ['color.error.text', 'color.success.text', 'color.warning.text', 'color.primary.text'],
    },
    truncate: { control: 'boolean' },
    textAlign: { control: 'select', options: ['inherit', 'initial', 'left', 'right', 'center', 'justify'] },
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
    <Text as={args.as} variant={args.variant} weight={args.weight} textAlignment={args.textAlignment} {...args}>
      Hola caracola
    </Text>
  );
};

Basic.args = {
  variant: undefined,
  as: 'h1',
  weight: 'fontWeightBold',
  textAlign: 'center',
  truncate: false,
  color: 'color.error.text',
  children: 'Hola caracola',
};

export default meta;

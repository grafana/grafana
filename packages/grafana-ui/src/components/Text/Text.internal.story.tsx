import { Meta, StoryFn } from '@storybook/react';
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
    truncate: { control: 'boolean' },
    italic: { control: 'boolean' },
    textAlignment: {
      control: 'select',
      options: ['inherit', 'initial', 'left', 'right', 'center', 'justify', undefined],
    },
  },
  args: {
    element: 'h1',
    variant: undefined,
    weight: 'light',
    textAlignment: 'left',
    truncate: false,
    italic: false,
    color: 'primary',
    children: `This is an example of a Text component`,
  },
};

export const Example: StoryFn = (args) => {
  return (
    <VerticalGroup>
      <StoryExample name="Header, paragraph and span">
        <Text {...args} element="h1">
          This is a header
        </Text>
        <Text {...args} element="p">
          This is a paragraph that contains
          <Text color="success" italic>
            {' '}
            a span element with different color and style{' '}
          </Text>
          but is comprised within the same block text
        </Text>
      </StoryExample>
      <StoryExample name="Paragraph with truncate set to true and wrapping up a span element">
        <Text {...args} element="p" truncate>
          This is a paragraph that contains
          <Text color="warning" italic>
            {' '}
            a span element{' '}
          </Text>
          but has truncate set to true
        </Text>
      </StoryExample>
    </VerticalGroup>
  );
};
Example.parameters = {
  controls: {
    exclude: ['element', 'variant', 'weight', 'textAlignment', 'truncate', 'italic', 'color', 'children'],
  },
};

export const Basic: StoryFn = (args) => {
  return (
    <div style={{ width: '300px' }}>
      <Text
        element={args.element}
        variant={args.variant}
        weight={args.weight}
        textAlignment={args.textAlignment}
        {...args}
      >
        {args.children}
      </Text>
    </div>
  );
};

export default meta;

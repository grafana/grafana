import { Meta, StoryFn } from '@storybook/react';

import { StoryExample } from '../../utils/storybook/StoryExample';
import { Stack } from '../Layout/Stack/Stack';

import { Text } from './Text';
import mdx from './Text.mdx';

const meta: Meta = {
  title: 'Foundations/Text',
  component: Text,
  parameters: {
    docs: {
      page: mdx,
    },
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'body', 'bodySmall', 'code', undefined],
    },
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
    tabular: { control: 'boolean' },
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
    <Stack direction="column">
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
    </Stack>
  );
};

Example.parameters = {
  controls: {
    exclude: ['element', 'variant', 'weight', 'textAlignment', 'truncate', 'italic', 'tabular', 'color', 'children'],
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

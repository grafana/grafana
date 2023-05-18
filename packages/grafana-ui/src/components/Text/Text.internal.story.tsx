import { Meta, StoryFn } from '@storybook/react';
import React from 'react';

import { StoryExample } from '../../utils/storybook/StoryExample';
import { VerticalGroup } from '../Layout/Layout';

import { Text } from './Text';
import mdx from './Text.mdx';
import { H1, H2, H3, H4, H5, H6, P } from './TextElements';

const meta: Meta = {
  title: 'General/Text',
  component: Text,
  parameters: {
    docs: {
      page: mdx,
    },
    controls: { exclude: ['as'] },
  },
  argTypes: {
    variant: { control: 'select', options: ['body', 'bodySmall', undefined] },
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
    textAlignment: {
      control: 'select',
      options: ['inherit', 'initial', 'left', 'right', 'center', 'justify', undefined],
    },
  },
};

export const Example: StoryFn = () => {
  return (
    <VerticalGroup>
      <StoryExample name="Headings and paragraph elements">
        <H1>h1. Heading</H1>
        <H2>h2. Heading</H2>
        <H3>h3. Heading</H3>
        <H4>h4. Heading</H4>
        <H5>h5. Heading</H5>
        <H6>h6. Heading</H6>
        <P>This is a paragraph</P>
      </StoryExample>
    </VerticalGroup>
  );
};
Example.parameters = {
  controls: {
    exclude: ['variant', 'weight', 'textAlignment', 'truncate', 'color', 'children'],
  },
};

export const HeadingComponent: StoryFn = (args) => {
  return (
    <div style={{ width: '300px' }}>
      <H1 variant={args.variant} weight={args.weight} textAlignment={args.textAlignment} {...args}>
        {args.children}
      </H1>
    </div>
  );
};
HeadingComponent.args = {
  variant: undefined,
  weight: 'light',
  textAlignment: 'center',
  truncate: false,
  color: 'primary',
  children: 'This is a H1 component',
};

export const TextComponent: StoryFn = (args) => {
  return (
    <div style={{ width: '300px' }}>
      <H6 variant={args.variant} weight={args.weight} textAlignment={args.textAlignment} {...args}>
        {args.children}
        <Text weight="bold" color="error">
          {' '}
          with a part of its text with a different style
        </Text>
        !
      </H6>
    </div>
  );
};
TextComponent.args = {
  variant: undefined,
  weight: 'light',
  textAlignment: 'center',
  truncate: false,
  color: 'maxContrast',
  children: 'This is a H6 component',
};

export default meta;

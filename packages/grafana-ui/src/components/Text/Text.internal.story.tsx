import { Meta, StoryFn } from '@storybook/react';
import React from 'react';

import { StoryExample } from '../../utils/storybook/StoryExample';
import { VerticalGroup } from '../Layout/Layout';

import { Text } from './Text';
import mdx from './Text.mdx';
import { H1, H2, H3, H4, H5, H6, Span, P, Legend, TextModifier } from './TextElements';

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
    textAlignment: {
      control: 'select',
      options: ['inherit', 'initial', 'left', 'right', 'center', 'justify', undefined],
    },
  },
};

export const Example: StoryFn = () => {
  return (
    <VerticalGroup>
      <StoryExample name="Header, paragraph, span and legend elements">
        <H1>h1. Heading</H1>
        <H2>h2. Heading</H2>
        <H3>h3. Heading</H3>
        <H4>h4. Heading</H4>
        <H5>h5. Heading</H5>
        <H6>h6. Heading</H6>
        <P>This is a paragraph</P>
        <Legend>This is a legend</Legend>
        <Span>This is a span</Span>
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

export const LegendComponent: StoryFn = (args) => {
  return (
    <div style={{ width: '300px' }}>
      <Legend variant={args.variant} weight={args.weight} textAlignment={args.textAlignment} {...args}>
        {args.children}
      </Legend>
    </div>
  );
};

LegendComponent.args = {
  variant: undefined,
  weight: 'bold',
  textAlignment: 'center',
  truncate: false,
  color: 'error',
  children: 'This is a lengend component',
};

export const TextModifierComponent: StoryFn = (args) => {
  return (
    <div style={{ width: '300px' }}>
      <H6 variant={args.variant} weight={args.weight} textAlignment={args.textAlignment} {...args}>
        {args.children}{' '}
        <TextModifier weight="bold" color="error">
          {' '}
          with a part of its text modified{' '}
        </TextModifier>
      </H6>
    </div>
  );
};
TextModifierComponent.args = {
  variant: undefined,
  weight: 'light',
  textAlignment: 'center',
  truncate: false,
  color: 'maxContrast',
  children: 'This is a H6 component',
};

export default meta;

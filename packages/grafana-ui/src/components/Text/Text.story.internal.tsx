import { Meta, Story } from '@storybook/react';
import React from 'react';

import { StoryExample } from '../../utils/storybook/StoryExample';
import { VerticalGroup } from '../Layout/Layout';

import { Text } from './Text';
import mdx from './Text.mdx';
import { H1, H2, H3, H4, H5, H6, P, Span, Legend } from './TextElements';

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
        <p>This is a paragraph</p>
        <span>This is a span</span>
        <legend>This is a legend</legend>
      </StoryExample>
    </VerticalGroup>
  );
};

export const ExperimentalH1: Story = (args) => {
  return (
    <div style={{ width: '300px' }}>
      <H1 variant={args.variant} weight={args.weight} textAlignment={args.textAlignment} {...args}>
        {args.children}
      </H1>
    </div>
  );
};
ExperimentalH1.args = {
  variant: undefined,
  weight: 'fontWeightBold',
  textAlignment: 'center',
  truncate: false,
  color: 'color.error.text',
  children: 'This is a H1 component',
};
export const ExperimentalH2: Story = (args) => {
  return (
    <div style={{ width: '300px' }}>
      <H2 variant={args.variant} weight={args.weight} textAlignment={args.textAlignment} {...args}>
        {args.children}
      </H2>
    </div>
  );
};
ExperimentalH2.args = {
  variant: undefined,
  weight: 'fontWeightBold',
  textAlignment: 'center',
  truncate: false,
  color: 'color.error.text',
  children: 'This is a H2 component',
};
export const ExperimentalH3: Story = (args) => {
  return (
    <div style={{ width: '300px' }}>
      <H3 variant={args.variant} weight={args.weight} textAlignment={args.textAlignment} {...args}>
        {args.children}
      </H3>
    </div>
  );
};
ExperimentalH3.args = {
  variant: undefined,
  weight: 'fontWeightBold',
  textAlignment: 'center',
  truncate: false,
  color: 'color.error.text',
  children: 'This is a H3 component',
};
export const ExperimentalH4: Story = (args) => {
  return (
    <div style={{ width: '300px' }}>
      <H4 variant={args.variant} weight={args.weight} textAlignment={args.textAlignment} {...args}>
        {args.children}
      </H4>
    </div>
  );
};
ExperimentalH4.args = {
  variant: undefined,
  weight: 'fontWeightBold',
  textAlignment: 'center',
  truncate: false,
  color: 'color.error.text',
  children: 'This is a H4 component',
};
export const ExperimentalH5: Story = (args) => {
  return (
    <div style={{ width: '300px' }}>
      <H5 variant={args.variant} weight={args.weight} textAlignment={args.textAlignment} {...args}>
        {args.children}
      </H5>
    </div>
  );
};
ExperimentalH5.args = {
  variant: undefined,
  weight: 'fontWeightBold',
  textAlignment: 'center',
  truncate: false,
  color: 'color.error.text',
  children: 'This is a H5 component',
};
export const ExperimentalH6: Story = (args) => {
  return (
    <div style={{ width: '300px' }}>
      <H6 variant={args.variant} weight={args.weight} textAlignment={args.textAlignment} {...args}>
        {args.children}
      </H6>
    </div>
  );
};
ExperimentalH6.args = {
  variant: undefined,
  weight: 'fontWeightBold',
  textAlignment: 'center',
  truncate: false,
  color: 'color.error.text',
  children: 'This is a H6 component',
};
export const ExperimentalBody: Story = (args) => {
  return (
    <div style={{ width: '300px' }}>
      <P variant={args.variant} weight={args.weight} textAlignment={args.textAlignment} {...args}>
        {args.children}
      </P>
    </div>
  );
};
ExperimentalBody.args = {
  variant: undefined,
  weight: 'fontWeightBold',
  textAlignment: 'center',
  truncate: false,
  color: 'color.error.text',
  children: 'This is a P component',
};
export const ExperimentalSpan: Story = (args) => {
  return (
    <div style={{ width: '300px' }}>
      <Span variant={args.variant} weight={args.weight} textAlignment={args.textAlignment} {...args}>
        {args.children}
      </Span>
    </div>
  );
};
ExperimentalSpan.args = {
  variant: undefined,
  weight: 'fontWeightBold',
  textAlignment: 'center',
  truncate: false,
  color: 'color.error.text',
  children: 'This is a Span component',
};

export const ExperimentalLegend: Story = (args) => {
  return (
    <div style={{ width: '300px' }}>
      <Legend variant={args.variant} weight={args.weight} textAlignment={args.textAlignment} {...args}>
        {args.children}
      </Legend>
    </div>
  );
};

ExperimentalLegend.args = {
  variant: undefined,
  weight: 'fontWeightBold',
  textAlignment: 'center',
  truncate: false,
  color: 'color.error.text',
  children: 'This is a Lengend component',
};

export default meta;

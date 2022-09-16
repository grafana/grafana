import { ComponentMeta, ComponentStory } from '@storybook/react';
import React from 'react';

import { Label } from './Label';
import mdx from './Label.mdx';

const meta: ComponentMeta<typeof Label> = {
  title: 'Forms/Label',
  component: Label,
  argTypes: {
    children: { control: { type: 'text' } },
    description: { control: { type: 'text' } },
  },
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

export const simple: ComponentStory<typeof Label> = (args) => {
  return <Label {...args} />;
};

simple.parameters = {
  controls: { exclude: ['category'] },
};

simple.args = {
  children: 'Option name',
  description: 'Option description',
};

export const categorised: ComponentStory<typeof Label> = (args) => {
  return <Label {...args} />;
};

categorised.args = {
  children: 'Option name',
  description: 'Option description',
  category: ['Category', 'Nested category'],
};

export default meta;

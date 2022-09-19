import { ComponentMeta, ComponentStory } from '@storybook/react';
import React, { useState, useCallback } from 'react';

import { Input, Switch } from '..';

import { Field } from './Field';
import mdx from './Field.mdx';

const meta: ComponentMeta<typeof Field> = {
  title: 'Forms/Field',
  component: Field,
  argTypes: {
    label: { control: { type: 'text' } },
    description: { control: { type: 'text' } },
    error: { control: { type: 'text' } },
  },
  parameters: {
    docs: {
      page: mdx,
    },
    knobs: {
      disabled: true,
    },
    controls: {
      exclude: ['children', 'className'],
    },
  },
};

export const Simple: ComponentStory<typeof Field> = (args) => (
  <div>
    <Field {...args}>
      <Input id="thisField" />
    </Field>
  </div>
);

Simple.args = {
  label: 'Graphite API key',
  description: 'Your Graphite instance API key',
  disabled: false,
  invalid: false,
  loading: false,
  error: 'Not valid input',
  horizontal: false,
};

export const HorizontalLayout: ComponentStory<typeof Field> = (args) => {
  const [checked, setChecked] = useState(false);
  const onChange = useCallback(
    (e: React.FormEvent<HTMLInputElement>) => setChecked(e.currentTarget.checked),
    [setChecked]
  );
  return (
    <div>
      <Field {...args}>
        <Switch checked={checked} onChange={onChange} />
      </Field>
    </div>
  );
};

HorizontalLayout.args = {
  label: 'Show labels',
  description: 'Display threshold labels',
  disabled: false,
  invalid: false,
  loading: false,
  error: 'Not valid input',
  horizontal: true,
};

export default meta;

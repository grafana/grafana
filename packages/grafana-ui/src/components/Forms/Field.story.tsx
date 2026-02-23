import { Meta, StoryFn } from '@storybook/react';
import { useState, useCallback, useId } from 'react';
import * as React from 'react';

import { Input } from '../Input/Input';
import { Switch } from '../Switch/Switch';

import { Field } from './Field';
import mdx from './Field.mdx';

const meta: Meta<typeof Field> = {
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

export const Simple: StoryFn<typeof Field> = (args) => {
  const id = useId();
  return (
    <div>
      <Field {...args}>
        <Input id={id} />
      </Field>
    </div>
  );
};

Simple.args = {
  label: 'Graphite API key',
  description: 'Your Graphite instance API key',
  disabled: false,
  invalid: false,
  loading: false,
  error: 'Not valid input',
  horizontal: false,
};

export const HorizontalLayout: StoryFn<typeof Field> = (args) => {
  const id = useId();
  const [checked, setChecked] = useState(false);
  const onChange = useCallback(
    (e: React.FormEvent<HTMLInputElement>) => setChecked(e.currentTarget.checked),
    [setChecked]
  );
  return (
    <div>
      <Field {...args}>
        <Switch checked={checked} onChange={onChange} id={id} />
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

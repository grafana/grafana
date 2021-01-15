import React, { useState, useCallback } from 'react';
import { Story } from '@storybook/react';
import { Field, FieldProps } from './Field';
import { Input, Switch } from '..';
import mdx from './Field.mdx';

export default {
  title: 'Forms/Field',
  component: Field,
  argTypes: {
    children: { control: { disable: true } },
    className: { control: { disable: true } },
  },
  parameters: {
    docs: {
      page: mdx,
    },
    knobs: {
      disabled: true,
    },
  },
};

export const Simple: Story<FieldProps> = (args) => (
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

export const HorizontalLayout: Story<FieldProps> = (args) => {
  const [checked, setChecked] = useState(false);
  const onChange = useCallback((e) => setChecked(e.currentTarget.checked), [setChecked]);
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

import { Meta, StoryFn } from '@storybook/react';
import { useState, useCallback } from 'react';
import * as React from 'react';

import { Stack } from '../Layout/Stack/Stack';

import { Checkbox } from './Checkbox';
import mdx from './Checkbox.mdx';
import { Field } from './Field';

const meta: Meta<typeof Checkbox> = {
  title: 'Inputs/Checkbox',
  component: Checkbox,
  parameters: {
    docs: {
      page: mdx,
    },
    controls: {
      exclude: ['value', 'htmlValue'],
    },
    // TODO fix a11y issue in story and remove this
    a11y: { test: 'off' },
  },
};

export const Basic: StoryFn<typeof Checkbox> = (args) => {
  const [checked, setChecked] = useState(false);
  const onChange = useCallback(
    (e: React.FormEvent<HTMLInputElement>) => setChecked(e.currentTarget.checked),
    [setChecked]
  );
  return <Checkbox value={checked} onChange={onChange} {...args} />;
};

Basic.args = {
  label: 'Skip TLS cert validation',
  description: 'Set to true if you want to skip TLS cert validation',
  disabled: false,
  indeterminate: false,
  invalid: false,
};

export const StackedList = () => {
  return (
    <div>
      <Stack direction="column" alignItems="flex-start">
        <Checkbox
          defaultChecked={true}
          label="Skip TLS cert validation"
          description="Set to true if you want to skip TLS cert validation"
        />
        <Checkbox
          defaultChecked={true}
          label="Another checkbox"
          description="Another long description that does not make any sense"
        />
        <Checkbox
          defaultChecked={true}
          label="Another checkbox times 2"
          description="Another long description that does not make any sense or does it?"
        />
      </Stack>
    </div>
  );
};

export const InAField: StoryFn<typeof Checkbox> = (args) => {
  return (
    <Field {...args}>
      <Checkbox name="hide" id="hide" defaultChecked={true} />
    </Field>
  );
};

InAField.args = {
  label: 'Hidden',
  description:
    'Annotation queries can be toggled on or of at the top of the dashboard. With this option checked this toggle will be hidden.',
  disabled: false,
  indeterminate: false,
  invalid: false,
};

export const AllStates: StoryFn<typeof Checkbox> = (args) => {
  const [checked, setChecked] = useState(false);
  const onChange = useCallback(
    (e: React.FormEvent<HTMLInputElement>) => setChecked(e.currentTarget.checked),
    [setChecked]
  );

  return (
    <div>
      <Stack direction="column" alignItems="flex-start">
        <Checkbox value={checked} onChange={onChange} {...args} />
        <Checkbox value={true} label="Checked" />
        <Checkbox value={false} label="Unchecked" />
        <Checkbox value={false} indeterminate={true} label="Interdeterminate" />
        <Checkbox value={false} invalid={true} label="Invalid and unchecked" />
        <Checkbox value={true} invalid={true} label="Invalid and checked" />
      </Stack>
    </div>
  );
};

AllStates.args = {
  label: 'Props set from controls',
  description: 'Set to true if you want to skip TLS cert validation',
  disabled: false,
  indeterminate: false,
  invalid: false,
};

export default meta;

import { Meta, StoryFn } from '@storybook/react';
import { useState, useCallback } from 'react';
import * as React from 'react';

import { Field } from '../Forms/Field';
import { InlineField } from '../Forms/InlineField';
import { InlineFieldRow } from '../Forms/InlineFieldRow';

import { InlineSwitch, Switch } from './Switch';
import mdx from './Switch.mdx';

const meta: Meta<typeof Switch> = {
  title: 'Inputs/Switch',
  component: Switch,
  parameters: {
    docs: {
      page: mdx,
    },
    // TODO fix a11y issue in story and remove this
    a11y: { test: 'off' },
  },
  args: {
    disabled: false,
    value: false,
    invalid: false,
  },
};

export const Controlled: StoryFn<typeof Switch> = (args) => {
  return (
    <div>
      <div style={{ marginBottom: '32px' }}>
        <Field label="Normal switch" description="For horizontal forms" invalid={args.invalid}>
          <Switch value={args.value} disabled={args.disabled} id="normal-switch" />
        </Field>
      </div>
      <div style={{ marginBottom: '32px' }}>
        <InlineFieldRow>
          <InlineField label="My switch" invalid={args.invalid} disabled={args.disabled}>
            <InlineSwitch value={args.value} id="my-switch" />
          </InlineField>
        </InlineFieldRow>
      </div>
      <div style={{ marginBottom: '32px' }}>
        <div>just inline switch with show label</div>
        <span>
          <InlineSwitch
            label="Raw data"
            showLabel={true}
            value={args.value}
            disabled={args.disabled}
            invalid={args.invalid}
          />
        </span>
      </div>
    </div>
  );
};

export const Uncontrolled: StoryFn<typeof Switch> = (args) => {
  const [checked, setChecked] = useState(args.value);
  const onChange = useCallback(
    (e: React.FormEvent<HTMLInputElement>) => setChecked(e.currentTarget.checked),
    [setChecked]
  );
  return <Switch value={checked} disabled={args.disabled} onChange={onChange} invalid={args.invalid} />;
};

export default meta;

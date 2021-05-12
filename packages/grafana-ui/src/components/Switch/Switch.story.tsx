import React, { useState, useCallback } from 'react';
import { Story } from '@storybook/react';
import { withCenteredStory, withHorizontallyCenteredStory } from '../../utils/storybook/withCenteredStory';
import { InlineField, Switch, InlineSwitch } from '@grafana/ui';
import mdx from './Switch.mdx';
import { InlineFieldRow } from '../Forms/InlineFieldRow';
import { Field } from '../Forms/Field';

export default {
  title: 'Forms/Switch',
  component: Switch,
  decorators: [withCenteredStory, withHorizontallyCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
    knobs: {
      disable: true,
    },
  },
  args: {
    disabled: false,
  },
};

export const Controlled: Story = (args) => {
  const [checked, setChecked] = useState(args.value);
  const onChange = useCallback((e) => setChecked(e.currentTarget.checked), [setChecked]);

  return (
    <div>
      <div style={{ marginBottom: '32px' }}>
        <Field label="Normal switch" description="For horizontal forms">
          <Switch value={checked} disabled={args.disabled} transparent={args.transparent} onChange={onChange} />
        </Field>
      </div>
      <div style={{ marginBottom: '32px' }}>
        <InlineFieldRow>
          <InlineField label="My switch">
            <InlineSwitch value={checked} disabled={args.disabled} transparent={args.transparent} onChange={onChange} />
          </InlineField>
        </InlineFieldRow>
      </div>
      <div style={{ marginBottom: '32px' }}>
        <div>just inline switch with show label</div>
        <span>
          <InlineSwitch
            label="Raw data"
            showLabel={true}
            value={checked}
            disabled={args.disabled}
            transparent={args.transparent}
            onChange={onChange}
          />
        </span>
      </div>
    </div>
  );
};
Controlled.args = {
  value: false,
  transparent: false,
};

export const Uncontrolled: Story = (args) => {
  return <Switch disabled={args.disabled} />;
};

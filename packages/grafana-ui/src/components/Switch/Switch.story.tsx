import React, { useState, useCallback } from 'react';
import { boolean } from '@storybook/addon-knobs';
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
  },
};

export const Controlled = () => {
  const [checked, setChecked] = useState(false);
  const onChange = useCallback((e) => setChecked(e.currentTarget.checked), [setChecked]);
  const BEHAVIOUR_GROUP = 'Behaviour props';
  const disabled = boolean('Disabled', false, BEHAVIOUR_GROUP);

  return (
    <div>
      <div style={{ marginBottom: '32px' }}>
        <Field label="Normal switch" description="For horizontal forms">
          <Switch value={checked} disabled={disabled} onChange={onChange} />
        </Field>
      </div>
      <div style={{ marginBottom: '32px' }}>
        <InlineFieldRow>
          <InlineField label="My switch">
            <InlineSwitch value={checked} disabled={disabled} onChange={onChange} />
          </InlineField>
        </InlineFieldRow>
      </div>
    </div>
  );
};

export const Uncontrolled = () => {
  const BEHAVIOUR_GROUP = 'Behaviour props';
  const disabled = boolean('Disabled', false, BEHAVIOUR_GROUP);
  return <Switch disabled={disabled} />;
};

import React, { useState } from 'react';
import { boolean, number, text } from '@storybook/addon-knobs';
import { Field } from './Field';
import { Input } from './Input/Input';
import { Switch } from './Switch';
import mdx from './Field.mdx';

export default {
  title: 'UI/Forms/Field',
  component: Field,
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

const getKnobs = () => {
  const CONTAINER_GROUP = 'Container options';
  // ---
  const containerWidth = number(
    'Container width',
    300,
    {
      range: true,
      min: 100,
      max: 500,
      step: 10,
    },
    CONTAINER_GROUP
  );

  const BEHAVIOUR_GROUP = 'Behaviour props';
  const disabled = boolean('Disabled', false, BEHAVIOUR_GROUP);
  const invalid = boolean('Invalid', false, BEHAVIOUR_GROUP);
  const loading = boolean('Loading', false, BEHAVIOUR_GROUP);
  const error = text('Error message', '', BEHAVIOUR_GROUP);

  return { containerWidth, disabled, invalid, loading, error };
};

export const simple = () => {
  const { containerWidth, ...otherProps } = getKnobs();
  return (
    <div style={{ width: containerWidth }}>
      <Field label="Graphite API key" description="Your Graphite instance API key" {...otherProps}>
        <Input id="thisField" />
      </Field>
    </div>
  );
};

export const horizontalLayout = () => {
  const [checked, setChecked] = useState(false);
  const { containerWidth, ...otherProps } = getKnobs();
  return (
    <div style={{ width: containerWidth }}>
      <Field horizontal label="Show labels" description="Display thresholds's labels" {...otherProps}>
        <Switch
          checked={checked}
          onChange={(e, checked) => {
            setChecked(checked);
          }}
        />
      </Field>
    </div>
  );
};

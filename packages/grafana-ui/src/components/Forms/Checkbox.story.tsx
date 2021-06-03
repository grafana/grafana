import React, { useState, useCallback } from 'react';
import mdx from './Checkbox.mdx';
import { Checkbox } from './Checkbox';
import { VerticalGroup } from '../Layout/Layout';
import { Field } from './Field';

export default {
  title: 'Forms/Checkbox',
  component: Checkbox,
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

export const Controlled = () => {
  const [checked, setChecked] = useState(false);
  const onChange = useCallback((e) => setChecked(e.currentTarget.checked), [setChecked]);
  return (
    <Checkbox
      value={checked}
      onChange={onChange}
      label="Skip TLS cert validation"
      description="Set to true if you want to skip TLS cert validation"
    />
  );
};

export const uncontrolled = () => {
  return (
    <Checkbox
      defaultChecked={true}
      label="Skip TLS cert validation"
      description="Set to true if you want to skip TLS cert validation"
    />
  );
};

export const StackedList = () => {
  return (
    <VerticalGroup>
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
    </VerticalGroup>
  );
};

export const InAField = () => {
  return (
    <Field
      label="Hidden"
      description="Annotation queries can be toggled on or of at the top of the dashboard. With this option checked this toggle will be hidden."
    >
      <Checkbox name="hide" id="hide" defaultChecked={true} />
    </Field>
  );
};

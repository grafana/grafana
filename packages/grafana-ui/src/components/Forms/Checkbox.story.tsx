import React, { useState, useCallback } from 'react';
import mdx from './Checkbox.mdx';
import { Checkbox } from './Checkbox';

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
  const onChange = useCallback(e => setChecked(e.currentTarget.checked), [setChecked]);
  return (
    <Checkbox
      value={checked}
      onChange={onChange}
      label="Skip SLL cert validation"
      description="Set to true if you want to skip sll cert validation"
    />
  );
};

export const uncontrolled = () => {
  return (
    <Checkbox
      defaultChecked={true}
      label="Skip SLL cert validation"
      description="Set to true if you want to skip sll cert validation"
    />
  );
};

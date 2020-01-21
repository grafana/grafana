import React, { useState } from 'react';
import mdx from './Checkbox.mdx';
import { Checkbox } from './Checkbox';

export default {
  title: 'UI/Forms/Checkbox',
  component: Checkbox,
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

export const controlled = () => {
  const [checked, setChecked] = useState(false);
  return (
    <Checkbox
      value={checked}
      onChange={e => setChecked(e.currentTarget.checked)}
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

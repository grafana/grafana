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

export const simple = () => {
  const [checked, setChecked] = useState(false);
  return (
    <Checkbox
      value={checked}
      onChange={setChecked}
      label="Skip SLL cert validation"
      description="Set to true if you want to skip sll cert validation"
    />
  );
};

import React, { useState } from 'react';
// import mdx from './Checkbox.mdx';
import { RadioButtonGroup } from './RadioButtonGroup';
import { RadioButton } from './RadioButton';

export default {
  title: 'UI/Forms/RadioButtonGroup',
  component: RadioButtonGroup,
  // parameters: {
  //   docs: {
  //     page: mdx,
  //   },
  // },
};

export const simple = () => {
  const [selected, setSelected] = useState();

  const values = ['Prometheus', 'Graphite', 'Elastic'];

  return (
    <RadioButtonGroup>
      {values.map(v => {
        return (
          <RadioButton value={v} onClick={setSelected} active={selected === v}>
            {v}
          </RadioButton>
        );
      })}
    </RadioButtonGroup>
  );
};

import React, { useState } from 'react';
import mdx from './RadioButtonGroup.mdx';
import { RadioButtonGroup } from './RadioButtonGroup';
import { RadioButtonSize } from './RadioButton';
import { boolean, select } from '@storybook/addon-knobs';

export default {
  title: 'Forms/RadioButtonGroup',
  component: RadioButtonGroup,
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

const sizes: RadioButtonSize[] = ['sm', 'md'];

export const RadioButtons = () => {
  const [selected, setSelected] = useState('elastic');
  const BEHAVIOUR_GROUP = 'Behaviour props';
  const disabled = boolean('Disabled', false, BEHAVIOUR_GROUP);
  const disabledItem = select('Disabled item', ['', 'graphite', 'prometheus', 'elastic'], '', BEHAVIOUR_GROUP);
  const VISUAL_GROUP = 'Visual options';
  const size = select<RadioButtonSize>('Size', sizes, 'md', VISUAL_GROUP);

  const options = [
    { label: 'Prometheus', value: 'prometheus' },
    { label: 'Graphite', value: 'graphite', icon: 'cloud' },
    { label: 'Elastic', value: 'elastic' },
  ];

  const optionsWithOnlyIcons = [
    { description: 'Prometheus', value: 'prometheus', icon: 'gf-interpolation-linear' },
    { description: 'Graphite', value: 'graphite', icon: 'gf-interpolation-smooth' },
    { description: 'Elastic', value: 'elastic', icon: 'gf-interpolation-step-after' },
  ];

  return (
    <div style={{ width: '100%' }}>
      <div style={{ marginBottom: '32px' }}>
        <h5>Full width</h5>
        <RadioButtonGroup
          options={options}
          disabled={disabled}
          disabledOptions={[disabledItem]}
          value={selected}
          onChange={(v) => setSelected(v!)}
          size={size}
          fullWidth
        />
      </div>
      <div style={{ marginBottom: '32px' }}>
        <h5>Auto width</h5>
        <RadioButtonGroup
          options={options}
          disabled={disabled}
          disabledOptions={[disabledItem]}
          value={selected}
          onChange={(v) => setSelected(v!)}
          size={size}
        />
      </div>
      <div style={{ marginBottom: '32px' }}>
        <h5>With only icons and descriptions</h5>
        <RadioButtonGroup
          options={optionsWithOnlyIcons}
          value={selected}
          onChange={(v) => setSelected(v!)}
          size={size}
        />
      </div>
    </div>
  );
};

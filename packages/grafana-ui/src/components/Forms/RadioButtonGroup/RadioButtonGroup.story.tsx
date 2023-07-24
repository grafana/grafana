import { Meta, Story } from '@storybook/react';
import React, { useState } from 'react';

import { RadioButtonGroup } from './RadioButtonGroup';
import mdx from './RadioButtonGroup.mdx';

const meta: Meta = {
  title: 'Forms/RadioButtonGroup',
  component: RadioButtonGroup,
  parameters: {
    docs: {
      page: mdx,
    },
    controls: {
      exclude: ['className', 'options', 'value', 'onChange', 'onClick', 'id'],
    },
  },
  argTypes: {
    disabledOptions: {
      name: 'Disabled item',
      control: { type: 'select' },
      options: ['', 'graphite', 'prometheus', 'elastic'],
    },
    size: { control: { type: 'select' }, options: ['sm', 'md'] },
  },
};

export const RadioButtons: Story = (args) => {
  const [selected, setSelected] = useState('elastic');

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
          disabled={args.disabled}
          disabledOptions={args.disabledOptions}
          value={selected}
          onChange={(v) => setSelected(v!)}
          size={args.size}
          fullWidth={args.fullWidth}
          invalid={args.invalid}
        />
      </div>
      <div style={{ marginBottom: '32px' }}>
        <h5>Auto width</h5>
        <RadioButtonGroup
          options={options}
          disabled={args.disabled}
          disabledOptions={args.disabledOptions}
          value={selected}
          onChange={(v) => setSelected(v!)}
          size={args.size}
          invalid={args.invalid}
        />
      </div>
      <div style={{ marginBottom: '32px' }}>
        <h5>With only icons and descriptions</h5>
        <RadioButtonGroup
          options={optionsWithOnlyIcons}
          value={selected}
          onChange={(v) => setSelected(v!)}
          size={args.size}
          invalid={args.invalid}
        />
      </div>
    </div>
  );
};
RadioButtons.args = {
  disabled: false,
  disabledOptions: '',
  size: 'md',
  fullWidth: true,
  invalid: false,
};

export default meta;

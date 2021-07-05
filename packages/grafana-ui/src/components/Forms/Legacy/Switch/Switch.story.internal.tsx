import React, { useState } from 'react';

import { Props, Switch } from './Switch';
import { Meta, Story } from '@storybook/react';

export default {
  title: 'Forms/Legacy/Switch',
  component: Switch,
  parameters: {
    controls: {
      exclude: ['className', 'labelClass', 'switchClass', 'onChange'],
    },
  },
} as Meta;

const SwitchWrapper: Story<Props> = ({ label, ...args }) => {
  const [checked, setChecked] = useState(false);
  return <Switch {...args} label={label} checked={checked} onChange={() => setChecked(!checked)} />;
};

export const Basic = SwitchWrapper.bind({});
Basic.args = {
  label: 'Label',
  tooltip: '',
};

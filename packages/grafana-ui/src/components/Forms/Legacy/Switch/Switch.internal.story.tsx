import { Meta, StoryFn } from '@storybook/react';
import React, { useState } from 'react';

import { Switch } from './Switch';

const meta: Meta<typeof Switch> = {
  title: 'Forms/Legacy/Switch',
  component: Switch,
  parameters: {
    controls: {
      exclude: ['className', 'labelClass', 'switchClass', 'onChange'],
    },
  },
};

const SwitchWrapper: StoryFn<typeof Switch> = ({ label, ...args }) => {
  const [checked, setChecked] = useState(false);
  return <Switch {...args} label={label} checked={checked} onChange={() => setChecked(!checked)} />;
};

export const Basic = SwitchWrapper.bind({});
Basic.args = {
  label: 'Label',
  tooltip: '',
};

export default meta;

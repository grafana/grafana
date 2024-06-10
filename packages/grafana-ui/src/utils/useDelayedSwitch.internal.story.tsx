import { Story } from '@storybook/react';
import React from 'react';

import { useDelayedSwitch } from './useDelayedSwitch';

export default {
  title: 'useDelayedSwitch',
};

export const Basic: Story = ({ value, delay, duration }) => {
  const valueDelayed = useDelayedSwitch(value, { delay, duration });
  return <div>{valueDelayed ? 'ON' : 'OFF'}</div>;
};
Basic.args = {
  value: false,
  duration: 2000,
  delay: 2000,
};

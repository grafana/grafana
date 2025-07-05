import { StoryFn } from '@storybook/react';

import { useDelayedSwitch } from './useDelayedSwitch';

export default {
  title: 'Utilities/useDelayedSwitch',
};

export const Basic: StoryFn = ({ value, delay, duration }) => {
  const valueDelayed = useDelayedSwitch(value, { delay, duration });
  return <div>{valueDelayed ? 'ON' : 'OFF'}</div>;
};
Basic.args = {
  value: false,
  duration: 2000,
  delay: 2000,
};

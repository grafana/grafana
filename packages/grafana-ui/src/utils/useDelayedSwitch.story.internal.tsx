import React from 'react';

import { withCenteredStory } from './storybook/withCenteredStory';
import { useDelayedSwitch } from './useDelayedSwitch';
import { boolean, number } from '@storybook/addon-knobs';

const getKnobs = () => {
  return {
    value: boolean('Value', false),
    duration: number('Duration to stay on', 2000),
    delay: number('Delay before switching on', 2000),
  };
};

function StoryWrapper() {
  const { value, delay = 0, duration = 0 } = getKnobs();
  const valueDelayed = useDelayedSwitch(value, { delay, duration });
  return <div>{valueDelayed ? 'ON' : 'OFF'}</div>;
}

export default {
  title: 'useDelayedSwitch',
  decorators: [withCenteredStory],
};

export const basic = () => {
  return <StoryWrapper />;
};

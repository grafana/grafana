import React, { useState } from 'react';

// import { storiesOf } from '@storybook/react';
// import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { Switch } from './Switch';
import { text } from '@storybook/addon-knobs';

export default {
  title: 'UI|Switch',
  parameters: {
    component: Switch,
  },
};

const getKnobs = () => {
  return {
    label: text('Label Text', 'Label'),
    tooltip: text('Tooltip', ''),
  };
};

const SwitchWrapper = () => {
  const { label, tooltip } = getKnobs();
  const [checked, setChecked] = useState(false);
  return <Switch label={label} checked={checked} onChange={() => setChecked(!checked)} tooltip={tooltip} />;
};

export const basic = () => <SwitchWrapper />;

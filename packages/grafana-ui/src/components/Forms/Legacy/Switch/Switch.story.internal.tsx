import React, { useState } from 'react';

import { Switch } from './Switch';
import { text } from '@storybook/addon-knobs';
import mdx from './Switch.mdx';

const getStory = (title: string, component: any) => ({
  title,
  parameters: {
    component,
    docs: {
      page: mdx,
    },
  },
});

export default getStory('Forms/Legacy/Switch', Switch);

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

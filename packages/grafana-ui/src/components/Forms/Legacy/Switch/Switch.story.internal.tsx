import React, { useState } from 'react';

import { Props, Switch } from './Switch';
import { Story } from '@storybook/react';
import mdx from './Switch.mdx';
import { NOOP_CONTROL } from '../../../../utils/storybook/noopControl';

const getStory = (title: string, component: any) => ({
  title,
  parameters: {
    component,
    docs: {
      page: mdx,
    },
    knobs: {
      disable: true,
    },
  },
  argTypes: {
    className: NOOP_CONTROL,
    labelClass: NOOP_CONTROL,
    switchClass: NOOP_CONTROL,
  },
});

export default getStory('Forms/Legacy/Switch', Switch);

const SwitchWrapper: Story<Props> = ({ label, ...args }) => {
  const [checked, setChecked] = useState(false);
  return <Switch {...args} label={label} checked={checked} onChange={() => setChecked(!checked)} />;
};

export const Basic = SwitchWrapper.bind({});
Basic.args = {
  label: 'Label',
  tooltip: '',
};

import React, { useState } from 'react';
import { boolean } from '@storybook/addon-knobs';
import { withCenteredStory, withHorizontallyCenteredStory } from '../../utils/storybook/withCenteredStory';
import { Switch } from './Switch';
import mdx from './Switch.mdx';

export default {
  title: 'UI/Forms/Switch',
  component: Switch,
  decorators: [withCenteredStory, withHorizontallyCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

export const simple = () => {
  const [checked, setChecked] = useState(false);
  const BEHAVIOUR_GROUP = 'Behaviour props';
  const disabled = boolean('Disabled', false, BEHAVIOUR_GROUP);
  return (
    <Switch
      checked={checked}
      disabled={disabled}
      onChange={(e, checked) => {
        setChecked(checked);
      }}
    />
  );
};

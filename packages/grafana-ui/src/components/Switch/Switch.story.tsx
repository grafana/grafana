import React, { useState, useCallback } from 'react';
import { boolean } from '@storybook/addon-knobs';
import { withCenteredStory, withHorizontallyCenteredStory } from '../../utils/storybook/withCenteredStory';
import { Switch } from './Switch';
import mdx from './Switch.mdx';

export default {
  title: 'Forms/Switch',
  component: Switch,
  decorators: [withCenteredStory, withHorizontallyCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

export const controlled = () => {
  const [checked, setChecked] = useState(false);
  const onChange = useCallback(e => setChecked(e.currentTarget.checked), [setChecked]);
  const BEHAVIOUR_GROUP = 'Behaviour props';
  const disabled = boolean('Disabled', false, BEHAVIOUR_GROUP);
  return <Switch checked={checked} disabled={disabled} onChange={onChange} />;
};

export const uncontrolled = () => {
  const BEHAVIOUR_GROUP = 'Behaviour props';
  const disabled = boolean('Disabled', false, BEHAVIOUR_GROUP);
  return <Switch disabled={disabled} />;
};

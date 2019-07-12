import React, { useState } from 'react';

import { storiesOf } from '@storybook/react';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { Switch } from './Switch';
import { text } from '@storybook/addon-knobs';

const getKnobs = () => {
  return {
    label: text('Label Text', 'Label'),
  };
};

const SwitchWrapper = () => {
  const { label } = getKnobs();
  const [checked, setChecked] = useState(false);
  return <Switch label={label} checked={checked} onChange={() => setChecked(!checked)} />;
};

const story = storiesOf('UI/Switch', module);
story.addDecorator(withCenteredStory);
story.add('switch', () => <SwitchWrapper />);

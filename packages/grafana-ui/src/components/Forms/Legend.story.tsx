import React from 'react';
import { storiesOf } from '@storybook/react';
import { text } from '@storybook/addon-knobs';

import { Legend } from './Legend';

const getKnobs = () => {
  return {
    label: text('text', 'Form section'),
  };
};

const story = storiesOf('Forms', module);

story.add('Legend', () => {
  const { label } = getKnobs();

  return <Legend>{label}</Legend>;
});

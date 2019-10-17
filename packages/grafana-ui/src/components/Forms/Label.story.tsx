import React from 'react';
import { storiesOf } from '@storybook/react';
import { text } from '@storybook/addon-knobs';

import { Label } from './Label';

const getKnobs = () => {
  return {
    label: text('text', 'Form element label'),
    description: text('description', 'Description of the form field'),
  };
};

const story = storiesOf('UI/Forms', module);

story.add('Label', () => {
  const { label, description } = getKnobs();

  return <Label description={description}>{label}</Label>;
});

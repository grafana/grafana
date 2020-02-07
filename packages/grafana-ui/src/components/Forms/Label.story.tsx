import React from 'react';

import { text } from '@storybook/addon-knobs';

import { Label } from './Label';

const getKnobs = () => {
  return {
    label: text('text', 'Form element label'),
    description: text('description', 'Description of the form field'),
  };
};

export default {
  title: 'Forms',
  component: Label,
};

export const simple = () => {
  const { label, description } = getKnobs();

  return <Label description={description}>{label}</Label>;
};

import React from 'react';
import { text } from '@storybook/addon-knobs';

import { Legend } from './Legend';

const getKnobs = () => {
  return {
    label: text('text', 'Form section'),
  };
};

export default {
  title: 'Forms/Legend',
  component: Legend,
};

export const basic = () => {
  const { label } = getKnobs();

  return <Legend>{label}</Legend>;
};

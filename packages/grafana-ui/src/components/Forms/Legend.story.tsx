import React from 'react';
import { text } from '@storybook/addon-knobs';

import { Legend } from '@grafana/ui';
import mdx from './Legend.mdx';

const getKnobs = () => {
  return {
    label: text('text', 'Form section'),
  };
};

export default {
  title: 'Forms/Legend',
  component: Legend,
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

export const basic = () => {
  const { label } = getKnobs();

  return <Legend>{label}</Legend>;
};

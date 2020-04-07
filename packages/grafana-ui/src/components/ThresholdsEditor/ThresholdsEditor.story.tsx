import React from 'react';
import { action } from '@storybook/addon-actions';
import { object } from '@storybook/addon-knobs';

import { ThresholdsEditor } from './ThresholdsEditor';
import { ThresholdsMode } from '@grafana/data';

export default {
  title: 'Panel/ThresholdsEditor',
  component: ThresholdsEditor,
};

const getKnobs = () => {
  return {
    initThresholds: object('Initial thresholds', {
      mode: ThresholdsMode.Absolute,
      steps: [
        { value: -Infinity, color: 'green' },
        { value: 50, color: 'red' },
      ],
    }),
  };
};

export const basic = () => <ThresholdsEditor onChange={action('Thresholds changed')} />;

export const withThresholds = () => (
  <ThresholdsEditor thresholds={getKnobs().initThresholds} onChange={action('Thresholds changed')} />
);

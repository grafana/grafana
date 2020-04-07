import React from 'react';
import { action } from '@storybook/addon-actions';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { ThresholdsEditor } from './ThresholdsEditor';
import { ThresholdsMode, ThresholdsConfig } from '@grafana/data';

const thresholds: ThresholdsConfig = {
  mode: ThresholdsMode.Absolute,
  steps: [
    { value: -Infinity, color: 'green' },
    { value: 50, color: 'red' },
    { value: 60, color: 'blue' },
  ],
};

export default {
  title: 'Panel/ThresholdsEditorNew',
  component: ThresholdsEditor,
  decorators: [withCenteredStory],
  parameters: {
    docs: {},
  },
};

export const Default = () => {
  return <ThresholdsEditor thresholds={{} as ThresholdsConfig} onChange={action('Thresholds changed')} />;
};

export const WithThreshold = () => {
  return <ThresholdsEditor thresholds={thresholds} onChange={action('Thresholds changed')} />;
};

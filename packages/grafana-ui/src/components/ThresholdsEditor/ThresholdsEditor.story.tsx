import React from 'react';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import { ThresholdsEditor } from './ThresholdsEditor';
import { getTheme } from '../../themes';
import { ThresholdsMode, Thresholds } from '@grafana/data';

const ThresholdsEditorStories = storiesOf('UI/ThresholdsEditor', module);
const thresholds: Thresholds = {
  mode: ThresholdsMode.Absolute,
  step: [
    { value: -Infinity, color: 'green' },
    { value: 50, color: 'red' },
  ],
};

ThresholdsEditorStories.add('default', () => {
  return <ThresholdsEditor theme={getTheme()} thresholds={{} as Thresholds} onChange={action('Thresholds changed')} />;
});

ThresholdsEditorStories.add('with thresholds', () => {
  return <ThresholdsEditor theme={getTheme()} thresholds={thresholds} onChange={action('Thresholds changed')} />;
});

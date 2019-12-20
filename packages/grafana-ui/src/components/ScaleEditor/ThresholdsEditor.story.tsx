import React from 'react';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import { ThresholdsEditor } from './ThresholdsEditor';
import { getTheme } from '../../themes';

const ThresholdsEditorStories = storiesOf('UI/ThresholdsEditor', module);
const thresholds = [
  { index: 0, value: -Infinity, color: 'green' },
  { index: 1, value: 50, color: 'red' },
];

ThresholdsEditorStories.add('default', () => {
  return <ThresholdsEditor theme={getTheme()} thresholds={[]} onChange={action('Thresholds changed')} />;
});

ThresholdsEditorStories.add('with thresholds', () => {
  return <ThresholdsEditor theme={getTheme()} thresholds={thresholds} onChange={action('Thresholds changed')} />;
});

import React from 'react';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import { ThresholdsEditor } from './ThresholdsEditor';

const ThresholdsEditorStories = storiesOf('UI/ThresholdsEditor', module);
const thresholds = [{ index: 0, value: -Infinity, color: 'green' }, { index: 1, value: 50, color: 'red' }];

ThresholdsEditorStories.add('default', () => {
  return <ThresholdsEditor thresholds={[]} onChange={action('Thresholds changed')} />;
});

ThresholdsEditorStories.add('with thresholds', () => {
  return <ThresholdsEditor thresholds={thresholds} onChange={action('Thresholds changed')} />;
});

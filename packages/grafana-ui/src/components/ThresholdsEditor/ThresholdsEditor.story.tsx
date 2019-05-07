import React from 'react';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import { ThresholdsEditor } from './ThresholdsEditor';
import { Scale } from '../../types/scale';

const ThresholdsEditorStories = storiesOf('UI/ThresholdsEditor', module);
const thresholds = [{ index: 0, value: -Infinity, color: 'green' }, { index: 1, value: 50, color: 'red' }];

ThresholdsEditorStories.add('default', () => {
  return (
    <ThresholdsEditor
      scale={{ thresholds: [] }}
      onChange={(scale: Scale) => {
        action('Thresholds changed');
        console.log('Changed', scale);
      }}
    />
  );
});

ThresholdsEditorStories.add('with thresholds', () => {
  return (
    <ThresholdsEditor
      scale={{ thresholds }}
      onChange={(scale: Scale) => {
        action('Thresholds changed');
        console.log('Changed', scale);
      }}
    />
  );
});

import { text } from '@storybook/addon-knobs';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { ValuePicker } from '@grafana/ui';
import React from 'react';
import { generateOptions } from '../Select/mockOptions';

export default {
  title: 'Pickers and Editors/ValuePicker',
  component: ValuePicker,
  decorators: [withCenteredStory],
};

const options = generateOptions();

export const simple = () => {
  const label = text('Label', 'Pick an option');
  return (
    <div style={{ width: '200px' }}>
      <ValuePicker options={options} label={label} onChange={v => console.log(v)} />
    </div>
  );
};

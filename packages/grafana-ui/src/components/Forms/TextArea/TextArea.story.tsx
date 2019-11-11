import React from 'react';
import { TextArea } from './TextArea';
import { withCenteredStory } from '../../../utils/storybook/withCenteredStory';
import { boolean, number, text } from '@storybook/addon-knobs';
import mdx from './TextArea.mdx';

export default {
  title: 'UI/Forms/TextArea',
  component: TextArea,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

export const simple = () => {
  const invalid = boolean('Invalid', false);
  const placeholder = text('Placeholder', 'This is just a placeholder');
  const containerWidth = number('Container width', 300, {
    range: true,
    min: 100,
    max: 500,
    step: 10,
  });

  return (
    <div style={{ width: containerWidth }}>
      <TextArea invalid={invalid} placeholder={placeholder} />
    </div>
  );
};

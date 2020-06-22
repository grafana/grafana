import React from 'react';
import { TextArea } from './TextArea';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { boolean, number, text } from '@storybook/addon-knobs';
import mdx from './TextArea.mdx';

export default {
  title: 'Forms/TextArea',
  component: TextArea,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

export const simple = () => {
  const BEHAVIOUR_GROUP = 'Behaviour props';
  // ---
  const invalid = boolean('Invalid', false, BEHAVIOUR_GROUP);
  const disabled = boolean('Disabled', false, BEHAVIOUR_GROUP);

  const VISUAL_GROUP = 'Visual options';
  // ---
  const placeholder = text('Placeholder', 'This is just a placeholder', VISUAL_GROUP);
  const cols = number('Cols', 30, { range: true, min: 5, max: 50, step: 5 }, VISUAL_GROUP);
  const CONTAINER_GROUP = 'Container options';
  // ---
  const containerWidth = number(
    'Container width',
    300,
    {
      range: true,
      min: 100,
      max: 500,
      step: 10,
    },
    CONTAINER_GROUP
  );

  return (
    <div style={{ width: containerWidth }}>
      <TextArea invalid={invalid} placeholder={placeholder} cols={cols} disabled={disabled} />
    </div>
  );
};

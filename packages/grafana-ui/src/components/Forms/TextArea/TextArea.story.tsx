import React from 'react';
import { TextArea } from './TextArea';
import { withCenteredStory } from '../../../utils/storybook/withCenteredStory';
import mdx from './TextArea.mdx';

export default {
  title: 'UI/Forms/Textarea',
  component: TextArea,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

export const simple = () => {
  return (
    <div style={{ width: '300px' }}>
      <TextArea />
    </div>
  );
};

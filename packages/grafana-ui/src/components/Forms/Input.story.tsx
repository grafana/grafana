import React from 'react';
import { Input } from './Input';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import mdx from './Input.mdx';

export default {
  title: 'UI/Forms/Input',
  component: Input,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

export const simple = () => {
  return <Input />;
};

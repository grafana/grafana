import React from 'react';
import { FieldSet } from './FieldSet';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import mdx from './FieldSet.mdx';

export default {
  title: 'Forms/FieldSet',
  component: FieldSet,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

export const single = () => {
  return <FieldSet />;
};

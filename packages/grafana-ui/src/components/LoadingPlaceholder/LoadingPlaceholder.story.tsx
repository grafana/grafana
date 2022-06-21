import React from 'react';

import { withCenteredStory } from '../../utils/storybook/withCenteredStory';

import { LoadingPlaceholder } from './LoadingPlaceholder';
import mdx from './LoadingPlaceholder.mdx';

export default {
  title: 'General/LoadingPlaceholder',
  component: LoadingPlaceholder,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

export const basic = () => {
  return <LoadingPlaceholder text="Loading..." />;
};

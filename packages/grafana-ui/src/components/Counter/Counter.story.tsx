import React from 'react';
import mdx from './Counter.mdx';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { Counter } from './Counter';

export default {
  title: 'General/Counter',
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

export const Simple = () => <Counter value={123456789} />;

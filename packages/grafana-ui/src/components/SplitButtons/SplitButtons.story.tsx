import React from 'react';
import { SplitButtons } from './SplitButtons';
import { withCenteredStory, withHorizontallyCenteredStory } from '../../utils/storybook/withCenteredStory';
import mdx from './SplitButtons.mdx';

export default {
  title: 'General/SplitButtons',
  component: SplitButtons,
  decorators: [withCenteredStory, withHorizontallyCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

export const simple = () => <SplitButtons />;

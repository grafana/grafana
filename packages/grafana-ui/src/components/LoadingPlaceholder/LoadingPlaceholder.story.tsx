import { ComponentStory, ComponentMeta } from '@storybook/react';
import React from 'react';

import { withCenteredStory } from '../../utils/storybook/withCenteredStory';

import { LoadingPlaceholder } from './LoadingPlaceholder';
import mdx from './LoadingPlaceholder.mdx';

const meta: ComponentMeta<typeof LoadingPlaceholder> = {
  title: 'General/LoadingPlaceholder',
  component: LoadingPlaceholder,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

export const basic: ComponentStory<typeof LoadingPlaceholder> = () => {
  return <LoadingPlaceholder text="Loading..." />;
};

export default meta;

import { Meta, StoryFn } from '@storybook/react';
import React from 'react';

import { withCenteredStory } from '../../utils/storybook/withCenteredStory';

import { PanelContainer } from './PanelContainer';
import mdx from './PanelContainer.mdx';

const meta: Meta<typeof PanelContainer> = {
  title: 'General/PanelContainer',
  component: PanelContainer,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

export const Basic: StoryFn<typeof PanelContainer> = () => {
  return (
    <PanelContainer>
      <h1>Here could be your component</h1>
    </PanelContainer>
  );
};

export default meta;

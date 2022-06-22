import { Meta, Story } from '@storybook/react';
import React from 'react';

import { withCenteredStory } from '../../utils/storybook/withCenteredStory';

import { PanelContainer } from './PanelContainer';
import mdx from './PanelContainer.mdx';

export default {
  title: 'General/PanelContainer',
  component: PanelContainer,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
  },
} as Meta;

export const Basic: Story = () => {
  return (
    <PanelContainer>
      <h1>Here could be your component</h1>
    </PanelContainer>
  );
};

import React from 'react';
import { ToolbarButton, ToolbarButtonRow, ButtonGroup } from '@grafana/ui';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { PageToolbar } from './PageToolbar';
import { DashboardStoryCanvas } from '../../utils/storybook/DashboardStoryCanvas';

export default {
  title: 'Layout/PageToolbar',
  component: PageToolbar,
  decorators: [withCenteredStory],
  parameters: {},
};

export const Examples = () => {
  return (
    <DashboardStoryCanvas>
      <PageToolbar icon="bell" title=""></PageToolbar>
    </DashboardStoryCanvas>
  );
};

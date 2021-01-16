import React from 'react';
import { ToolbarButton, HorizontalGroup, useTheme } from '@grafana/ui';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';

export default {
  title: 'Buttons/ToolbarButton',
  component: ToolbarButton,
  decorators: [withCenteredStory],
  parameters: {},
};

export const List = () => {
  const theme = useTheme();

  return (
    <div style={{ background: theme.colors.dashboardBg, padding: '32px' }}>
      <HorizontalGroup>
        <ToolbarButton>Just text</ToolbarButton>
        <ToolbarButton icon="sync" tooltip="Sync" />
        <ToolbarButton imgSrc="./grafana_icon.svg">With imgSrc</ToolbarButton>
        <ToolbarButton icon="cloud" isOpen={true}>
          isOpen
        </ToolbarButton>
        <ToolbarButton icon="cloud" isOpen={false}>
          isOpen = false
        </ToolbarButton>
      </HorizontalGroup>
    </div>
  );
};

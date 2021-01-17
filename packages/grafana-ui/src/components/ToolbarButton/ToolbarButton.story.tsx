import React from 'react';
import { ToolbarButton, ToolbarButtonGroup, useTheme, VerticalGroup } from '@grafana/ui';
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
      <VerticalGroup>
        Wrapped in normal ToolbarButtonGroup (md spacing)
        <ToolbarButtonGroup>
          <ToolbarButton>Just text</ToolbarButton>
          <ToolbarButton icon="sync" tooltip="Sync" />
          <ToolbarButton imgSrc="./grafana_icon.svg">With imgSrc</ToolbarButton>
          <ToolbarButton icon="cloud" isOpen={true}>
            isOpen
          </ToolbarButton>
          <ToolbarButton icon="cloud" isOpen={false}>
            isOpen = false
          </ToolbarButton>
        </ToolbarButtonGroup>
        <br />
        Wrapped in noSpacing ToolbarButtonGroup
        <ToolbarButtonGroup noSpacing>
          <ToolbarButton icon="clock-nine" tooltip="Time picker">
            2020-10-02
          </ToolbarButton>
          <ToolbarButton icon="search-minus" />
        </ToolbarButtonGroup>
        <br />
        Wrapped in noSpacing ToolbarButtonGroup
        <ToolbarButtonGroup noSpacing>
          <ToolbarButton icon="sync" />
          <ToolbarButton isOpen={false} narrow />
        </ToolbarButtonGroup>
      </VerticalGroup>
    </div>
  );
};

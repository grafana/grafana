import React from 'react';
import { ToolbarButton, ButtonGroup, useTheme, VerticalGroup, HorizontalGroup } from '@grafana/ui';
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
        Wrapped in normal ButtonGroup (md spacing)
        <ButtonGroup>
          <ToolbarButton>Just text</ToolbarButton>
          <ToolbarButton icon="sync" tooltip="Sync" />
          <ToolbarButton imgSrc="./grafana_icon.svg">With imgSrc</ToolbarButton>
          <ToolbarButton icon="cloud" isOpen={true}>
            isOpen
          </ToolbarButton>
          <ToolbarButton icon="cloud" isOpen={false}>
            isOpen = false
          </ToolbarButton>
        </ButtonGroup>
        <br />
        Wrapped in noSpacing ButtonGroup
        <ButtonGroup noSpacing>
          <ToolbarButton icon="clock-nine" tooltip="Time picker">
            2020-10-02
          </ToolbarButton>
          <ToolbarButton icon="search-minus" />
        </ButtonGroup>
        <br />
        Wrapped in noSpacing ButtonGroup
        <ButtonGroup noSpacing>
          <ToolbarButton icon="sync" />
          <ToolbarButton isOpen={false} narrow />
        </ButtonGroup>
        <br />
        As primary and destructive variant
        <HorizontalGroup>
          <ButtonGroup noSpacing>
            <ToolbarButton variant="primary" icon="sync">
              Run query
            </ToolbarButton>
            <ToolbarButton isOpen={false} narrow variant="primary" />
          </ButtonGroup>
          <ButtonGroup noSpacing>
            <ToolbarButton variant="destructive" icon="sync">
              Run query
            </ToolbarButton>
            <ToolbarButton isOpen={false} narrow variant="destructive" />
          </ButtonGroup>
        </HorizontalGroup>
      </VerticalGroup>
    </div>
  );
};

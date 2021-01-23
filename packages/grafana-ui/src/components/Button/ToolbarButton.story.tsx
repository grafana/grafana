import React from 'react';
import { ToolbarButton, ButtonGroup, useTheme, VerticalGroup, HorizontalGroup } from '@grafana/ui';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { ToolbarButtonRow } from './ToolbarButtonRow';

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
        Button states
        <ToolbarButtonRow>
          <ToolbarButton>Just text</ToolbarButton>
          <ToolbarButton icon="sync" tooltip="Sync" />
          <ToolbarButton imgSrc="./grafana_icon.svg">With imgSrc</ToolbarButton>
          <ToolbarButton icon="cloud" isOpen={true}>
            isOpen
          </ToolbarButton>
          <ToolbarButton icon="cloud" isOpen={false}>
            isOpen = false
          </ToolbarButton>
          <ToolbarButton icon="clock-nine" active>
            Active
          </ToolbarButton>
        </ToolbarButtonRow>
        <br />
        disabled
        <ToolbarButtonRow>
          <ToolbarButton icon="sync" disabled>
            Disabled
          </ToolbarButton>
        </ToolbarButtonRow>
        <br />
        Wrapped in noSpacing ButtonGroup
        <ButtonGroup>
          <ToolbarButton icon="clock-nine" tooltip="Time picker">
            2020-10-02
          </ToolbarButton>
          <ToolbarButton icon="search-minus" />
        </ButtonGroup>
        <br />
        <ButtonGroup>
          <ToolbarButton icon="sync" />
          <ToolbarButton isOpen={false} narrow />
        </ButtonGroup>
        <br />
        As primary and destructive variant
        <HorizontalGroup>
          <ButtonGroup>
            <ToolbarButton variant="primary" icon="sync">
              Run query
            </ToolbarButton>
            <ToolbarButton isOpen={false} narrow variant="primary" />
          </ButtonGroup>
          <ButtonGroup>
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

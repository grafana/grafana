import { Meta, StoryFn } from '@storybook/react';

import { DashboardStoryCanvas } from '../../utils/storybook/DashboardStoryCanvas';

import { ToolbarButton } from './ToolbarButton';
import { ToolbarButtonRow } from './ToolbarButtonRow';
import mdx from './ToolbarButtonRow.mdx';

const meta: Meta<typeof ToolbarButtonRow> = {
  title: 'Buttons/ToolbarButton/ToolbarButtonRow',
  component: ToolbarButtonRow,
  parameters: {
    docs: {
      page: mdx,
    },
    controls: {
      exclude: ['className'],
    },
  },
};

export const Basic: StoryFn<typeof ToolbarButtonRow> = (args) => {
  return (
    <DashboardStoryCanvas>
      <ToolbarButtonRow {...args}>
        <ToolbarButton>Just text</ToolbarButton>
        <ToolbarButton icon="sync" tooltip="Sync" />
        <ToolbarButton imgSrc="./grafana_icon.svg">With imgSrc</ToolbarButton>
        <ToolbarButton>Just text</ToolbarButton>
        <ToolbarButton icon="sync" tooltip="Sync" />
        <ToolbarButton imgSrc="./grafana_icon.svg">With imgSrc</ToolbarButton>
      </ToolbarButtonRow>
    </DashboardStoryCanvas>
  );
};

export default meta;

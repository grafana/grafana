import { action } from '@storybook/addon-actions';
import { StoryFn, Meta } from '@storybook/react';
import * as React from 'react';

import { IconButton } from '../IconButton/IconButton';
import { Text } from '../Text/Text';

import { ContextMenu, ContextMenuProps } from './ContextMenu';
import mdx from './ContextMenu.mdx';
import { renderMenuItems } from './ContextMenuStoryHelper';
import { WithContextMenu, WithContextMenuProps } from './WithContextMenu';

const meta: Meta<typeof ContextMenu> = {
  title: 'Overlays/ContextMenu',
  component: ContextMenu,
  parameters: {
    docs: {
      page: mdx,
    },
    controls: {
      exclude: ['renderMenuItems', 'renderHeader', 'onClose', 'children'],
    },
  },
  args: {
    x: 200,
    y: 300,
    focusOnOpen: true,
    renderMenuItems: renderMenuItems,
  },
};

const renderHeader = (): React.ReactNode => {
  return <Text variant="h6">Menu</Text>;
};

export const Basic: StoryFn<typeof ContextMenu> = (args: ContextMenuProps) => {
  return <ContextMenu {...args} onClose={() => action('onClose')('closed menu')} renderHeader={renderHeader} />;
};

export const WithState: StoryFn<typeof WithContextMenu> = (args: WithContextMenuProps) => {
  return (
    <WithContextMenu {...args}>
      {({ openMenu }) => <IconButton name="info-circle" onClick={openMenu} tooltip="More information" />}
    </WithContextMenu>
  );
};

export default meta;

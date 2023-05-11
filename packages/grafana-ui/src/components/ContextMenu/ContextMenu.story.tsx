import { action } from '@storybook/addon-actions';
import { StoryFn, Meta } from '@storybook/react';
import React from 'react';

import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { IconButton } from '../IconButton/IconButton';

import { ContextMenu, ContextMenuProps } from './ContextMenu';
import mdx from './ContextMenu.mdx';
import { renderMenuItems } from './ContextMenuStoryHelper';
import { WithContextMenu, WithContextMenuProps } from './WithContextMenu';

const meta: Meta<typeof ContextMenu> = {
  title: 'General/ContextMenu',
  component: ContextMenu,
  decorators: [withCenteredStory],
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
  return <h6>Menu</h6>;
};

export const Basic: StoryFn<typeof ContextMenu> = (args: ContextMenuProps) => {
  return <ContextMenu {...args} onClose={() => action('onClose')('closed menu')} renderHeader={renderHeader} />;
};

export const WithState: StoryFn<typeof WithContextMenu> = (args: WithContextMenuProps) => {
  return (
    <WithContextMenu {...args}>
      {({ openMenu }) => <IconButton name="info-circle" onClick={openMenu} />}
    </WithContextMenu>
  );
};

export default meta;

import React from 'react';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { IconButton } from '../IconButton/IconButton';
import { ContextMenu } from './ContextMenu';
import { WithContextMenu } from './WithContextMenu';
import mdx from './ContextMenu.mdx';

export default {
  title: 'General/ContextMenu',
  component: ContextMenu,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

const menuItems = [{ label: 'Test', items: [{ label: 'First' }, { label: 'Second' }] }];

export const Basic = () => {
  return <ContextMenu x={10} y={11} onClose={() => {}} items={menuItems} />;
};

export const WithState = () => {
  return (
    <WithContextMenu getContextMenuItems={() => menuItems}>
      {({ openMenu }) => <IconButton name="info-circle" onClick={openMenu} />}
    </WithContextMenu>
  );
};

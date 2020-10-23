import React from 'react';
import { ContextMenu } from './ContextMenu';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import mdx from './ContextMenu.mdx';
import { WithContextMenu } from './WithContextMenu';
import { IconButton } from '../IconButton/IconButton';

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

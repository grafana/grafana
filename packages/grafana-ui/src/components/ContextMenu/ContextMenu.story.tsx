import { ComponentMeta } from '@storybook/react';
import React from 'react';

import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { IconButton } from '../IconButton/IconButton';
import { MenuGroup } from '../Menu/MenuGroup';
import { MenuItem } from '../Menu/MenuItem';

import { ContextMenu } from './ContextMenu';
import mdx from './ContextMenu.mdx';
import { WithContextMenu } from './WithContextMenu';

const meta: ComponentMeta<typeof ContextMenu> = {
  title: 'General/ContextMenu',
  component: ContextMenu,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

const menuItems = [
  {
    label: 'Test',
    items: [
      { label: 'First', ariaLabel: 'First' },
      { label: 'Second', ariaLabel: 'Second' },
      { label: 'Third', ariaLabel: 'Third' },
      { label: 'Fourth', ariaLabel: 'Fourth' },
      { label: 'Fifth', ariaLabel: 'Fifth' },
    ],
  },
];

const renderMenuItems = () => {
  return menuItems.map((group, index) => (
    <MenuGroup key={`${group.label}${index}`} label={group.label}>
      {group.items.map((item) => (
        <MenuItem key={item.label} label={item.label} />
      ))}
    </MenuGroup>
  ));
};

export const Basic = () => {
  return <ContextMenu x={10} y={11} onClose={() => {}} renderMenuItems={renderMenuItems} />;
};

export const WithState = () => {
  return (
    <WithContextMenu renderMenuItems={renderMenuItems}>
      {({ openMenu }) => <IconButton name="info-circle" onClick={openMenu} />}
    </WithContextMenu>
  );
};

export default meta;

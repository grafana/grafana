import { action } from '@storybook/addon-actions';
import { ComponentStory, ComponentMeta } from '@storybook/react';
import React from 'react';

import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { IconButton } from '../IconButton/IconButton';
import { MenuGroup } from '../Menu/MenuGroup';
import { MenuItem } from '../Menu/MenuItem';

import { ContextMenu, ContextMenuProps } from './ContextMenu';
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
    controls: {
      exclude: ['renderMenuItems', 'renderHeader'],
    },
  },
  args: {
    x: 200,
    y: 300,
    focusOnOpen: true,
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

const renderHeader = (): React.ReactNode => {
  return <h6>Menu</h6>;
};

export const Basic: ComponentStory<typeof ContextMenu> = (args: ContextMenuProps) => {
  return (
    <ContextMenu
      {...args}
      onClose={() => action('onClose')('closed menu')}
      renderMenuItems={renderMenuItems}
      renderHeader={renderHeader}
    />
  );
};

export const WithState = () => {
  return (
    <WithContextMenu renderMenuItems={renderMenuItems}>
      {({ openMenu }) => <IconButton name="info-circle" onClick={openMenu} />}
    </WithContextMenu>
  );
};

export default meta;

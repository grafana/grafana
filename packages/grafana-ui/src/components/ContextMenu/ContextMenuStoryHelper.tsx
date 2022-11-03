import React from 'react';

import { MenuGroup } from '../Menu/MenuGroup';
import { MenuItem } from '../Menu/MenuItem';

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

export const renderMenuItems = () => {
  return menuItems.map((group, index) => (
    <MenuGroup key={`${group.label}${index}`} label={group.label}>
      {group.items.map((item) => (
        <MenuItem key={item.label} label={item.label} />
      ))}
    </MenuGroup>
  ));
};

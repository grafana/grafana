import React from 'react';
import { Story } from '@storybook/react';
import { Menu, MenuProps } from './Menu';
import { MenuItem } from './MenuItem';
import { MenuGroup } from './MenuGroup';
import { GraphContextMenuHeader } from '..';

export default {
  title: 'General/Menu',
  component: Menu,
  argTypes: {
    items: { control: { disable: true } },
    icon: { control: { type: 'select' } },
  },
  parameters: {
    knobs: {
      disabled: true,
    },
    controls: {
      disabled: true,
    },
    actions: {
      disabled: true,
    },
  },
};

export const Simple: Story<MenuProps> = (args) => {
  return (
    <div>
      <Menu header={args.header}>
        <MenuGroup label="Group 1">
          <MenuItem label="item1" icon="history" active={true} />
          <MenuItem label="item2" icon="filter" active={true} />
        </MenuGroup>
        <MenuGroup label="Group 2">
          <MenuItem label="item1" icon="history" active={true} />
        </MenuGroup>
      </Menu>
    </div>
  );
};

Simple.args = {
  header: (
    <GraphContextMenuHeader
      timestamp="2020-11-25 19:04:25"
      seriesColor="#00ff00"
      displayName="A-series"
      displayValue={{
        text: '128',
        suffix: 'km/h',
      }}
    />
  ),
};

import React from 'react';
import { Story } from '@storybook/react';
import { Menu, MenuProps } from './Menu';
import { GraphContextMenuHeader } from '..';

export default {
  title: 'General/Menu',
  component: Menu,
  argTypes: {
    items: { control: { disable: true } },
    header: { control: { disable: true } },
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

export const Simple: Story<MenuProps> = (args) => (
  <div>
    <Menu {...args} />
  </div>
);

Simple.args = {
  items: [
    {
      label: 'Group 1',
      items: [
        {
          label: 'Menu item 1',
          icon: 'history',
        },
        {
          label: 'Menu item 2',
          icon: 'filter',
        },
      ],
    },
    {
      label: 'Group 2',
      items: [
        {
          label: 'Menu item 1',
        },
        {
          label: 'Menu item 2',
        },
      ],
    },
  ],
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

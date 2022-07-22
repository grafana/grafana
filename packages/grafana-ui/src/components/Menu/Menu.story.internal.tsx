import { Story, ComponentMeta } from '@storybook/react';
import React from 'react';

import { GraphContextMenuHeader } from '..';
import { StoryExample } from '../../utils/storybook/StoryExample';
import { VerticalGroup } from '../Layout/Layout';

import { Menu } from './Menu';
import { MenuGroup } from './MenuGroup';
import { MenuItem } from './MenuItem';

const meta: ComponentMeta<typeof Menu> = {
  title: 'General/Menu',
  component: Menu,
  argTypes: {},
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

export const Simple: Story = (args) => {
  return (
    <VerticalGroup>
      <StoryExample name="Simple">
        <Menu>
          <MenuItem label="Google" icon="search-plus" />
          <MenuItem label="Filter" icon="filter" />
          <MenuItem label="History" icon="history" />
          <MenuItem label="Active" icon="history" active />
          <MenuItem label="Apps" icon="apps" />
        </Menu>
      </StoryExample>
      <StoryExample name="With header & groups">
        <Menu header={args.header} ariaLabel="Menu header">
          <MenuGroup label="Group 1">
            <MenuItem label="item1" icon="history" />
            <MenuItem label="item2" icon="filter" />
          </MenuGroup>
          <MenuGroup label="Group 2">
            <MenuItem label="item1" icon="history" />
          </MenuGroup>
        </Menu>
      </StoryExample>
      <StoryExample name="With submenu">
        <Menu>
          <MenuItem label="item1" icon="history" />
          <MenuItem
            label="item2"
            icon="apps"
            childItems={[
              <MenuItem key="subitem1" label="subitem1" icon="history" />,
              <MenuItem key="subitem2" label="subitem2" icon="apps" />,
              <MenuItem
                key="subitem3"
                label="subitem3"
                icon="search-plus"
                childItems={[
                  <MenuItem key="subitem1" label="subitem1" icon="history" />,
                  <MenuItem key="subitem2" label="subitem2" icon="apps" />,
                  <MenuItem key="subitem3" label="subitem3" icon="search-plus" />,
                ]}
              />,
            ]}
          />
          <MenuItem label="item3" icon="filter" />
        </Menu>
      </StoryExample>
    </VerticalGroup>
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

export default meta;

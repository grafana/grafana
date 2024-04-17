import React, { useRef } from 'react';

import { ButtonGroup, Dropdown, Menu, ToolbarButton } from '@grafana/ui';

import { Tabs, useQueriesDrawerContext } from './QueriesDrawerContext';
import { i18n } from './utils';

type Props = {
  variant: 'compact' | 'full';
};

export function QueriesDrawerDropdown({ variant }: Props) {
  const { selectedTab, setSelectedTab, queryLibraryAvailable, drawerOpened, setDrawerOpened } =
    useQueriesDrawerContext();

  const mainButton = useRef<HTMLButtonElement>(null);

  if (!queryLibraryAvailable) {
    return undefined;
  }

  const menu = (
    <Menu>
      <Menu.Item
        label={i18n.queryLibrary}
        onClick={() => {
          setSelectedTab(Tabs.QueryLibrary);
          setDrawerOpened(true);
        }}
      />
      <Menu.Item
        label={i18n.queryHistory}
        onClick={() => {
          setSelectedTab(Tabs.RichHistory);
          setDrawerOpened(true);
        }}
      />
    </Menu>
  );

  return (
    <ButtonGroup>
      {variant === 'full' && (
        <ToolbarButton
          icon="book"
          ref={mainButton}
          variant={drawerOpened ? 'active' : 'canvas'}
          onClick={() => setDrawerOpened(!drawerOpened)}
        >
          {selectedTab}
        </ToolbarButton>
      )}
      <Dropdown overlay={menu}>
        <ToolbarButton variant={drawerOpened ? 'active' : 'canvas'} icon={variant === 'full' ? 'angle-down' : 'book'} />
      </Dropdown>
    </ButtonGroup>
  );
}

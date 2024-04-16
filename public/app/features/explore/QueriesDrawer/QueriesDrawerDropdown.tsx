import React, { useRef } from 'react';

import { Button, ButtonGroup, Dropdown, Menu } from '@grafana/ui';

import { Tabs, useQueryLibraryContext } from './QueriesDrawerContext';
import { i18n } from './utils';

export function QueriesDrawerDropdown() {
  const { selectedTab, setSelectedTab, queryLibraryAvailable, setDrawerOpened } = useQueryLibraryContext();

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
      <Button ref={mainButton} variant="secondary" onClick={() => setDrawerOpened(true)}>
        {selectedTab}
      </Button>
      <Dropdown overlay={menu}>
        <Button variant="secondary" icon="angle-down" />
      </Dropdown>
    </ButtonGroup>
  );
}

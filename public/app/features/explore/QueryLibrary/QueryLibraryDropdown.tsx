import React, { useRef } from 'react';

import { Button, ButtonGroup, Dropdown, Menu } from '@grafana/ui';

import { Tabs, useQueryLibraryContext } from './QueryLibraryContext';
import { i18n } from './utils';

export function QueryLibraryDropdown() {
  const { selectedTab, setSelectedTab, enabled, setDrawerOpened } = useQueryLibraryContext();

  const mainButton = useRef<HTMLButtonElement>(null);

  if (!enabled) {
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

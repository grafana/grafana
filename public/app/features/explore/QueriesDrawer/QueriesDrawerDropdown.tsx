import React, { useRef } from 'react';

import { Button, ButtonGroup, Dropdown, Menu } from '@grafana/ui';

import { Tabs, useQueriesDrawerContext } from './QueriesDrawerContext';
import { i18n } from './utils';

type Props = {
  variant: 'compact' | 'full';
};

export function QueriesDrawerDropdown({ variant }: Props) {
  const { selectedTab, setSelectedTab, queryLibraryAvailable, setDrawerOpened } = useQueriesDrawerContext();

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
        <Button ref={mainButton} variant="secondary" onClick={() => setDrawerOpened(true)}>
          {selectedTab}
        </Button>
      )}
      <Dropdown overlay={menu}>
        <Button variant="secondary" icon={variant === 'full' ? 'angle-down' : 'book'} />
      </Dropdown>
    </ButtonGroup>
  );
}

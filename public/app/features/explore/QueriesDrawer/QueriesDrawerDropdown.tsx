import React, { useRef } from 'react';

import { Button, ButtonGroup, Dropdown, Menu, ToolbarButton } from '@grafana/ui';

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

  function toggle(tab: Tabs) {
    setSelectedTab(tab);
    setDrawerOpened(false);
    setDrawerOpened(true);
  }

  const menu = (
    <Menu>
      <Menu.Item label={i18n.queryLibrary} onClick={() => toggle(Tabs.QueryLibrary)} />
      <Menu.Item label={i18n.queryHistory} onClick={() => toggle(Tabs.RichHistory)} />
    </Menu>
  );

  let toolbarButton;
  if (variant === 'compact') {
    toolbarButton = <ToolbarButton variant={drawerOpened ? 'active' : 'canvas'} icon="book" />;
  } else {
    toolbarButton = <ToolbarButton variant="canvas" icon="angle-down" />;
  }

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
      {drawerOpened ? (
        <Button variant="secondary" icon="times" onClick={() => setDrawerOpened(false)}></Button>
      ) : (
        <Dropdown overlay={menu}>{toolbarButton}</Dropdown>
      )}
    </ButtonGroup>
  );
}

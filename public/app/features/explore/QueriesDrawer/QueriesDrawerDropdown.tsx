import { useState } from 'react';

import { Button, ButtonGroup, Dropdown, Menu, ToolbarButton } from '@grafana/ui';

import { queryLibraryTrackToggle } from '../QueryLibrary/QueryLibraryAnalyticsEvents';

import { Tabs, useQueriesDrawerContext } from './QueriesDrawerContext';
import { i18n } from './utils';

type Props = {
  variant: 'compact' | 'full';
};

export function QueriesDrawerDropdown({ variant }: Props) {
  const { selectedTab, setSelectedTab, queryLibraryAvailable, drawerOpened, setDrawerOpened } =
    useQueriesDrawerContext();

  const [isOpen, setIsOpen] = useState(false);

  if (!queryLibraryAvailable) {
    return undefined;
  }

  function toggle(tab: Tabs) {
    tab === Tabs.QueryLibrary && queryLibraryTrackToggle(!drawerOpened);

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

  return (
    <ButtonGroup>
      <ToolbarButton
        size="sm"
        icon="book"
        variant={drawerOpened ? 'active' : 'canvas'}
        onClick={() => {
          setDrawerOpened(!drawerOpened);
          selectedTab === Tabs.QueryLibrary && queryLibraryTrackToggle(!drawerOpened);
        }}
        aria-label={selectedTab}
      >
        {variant === 'full' ? selectedTab : undefined}
      </ToolbarButton>
      {drawerOpened ? (
        <Button
          size="sm"
          variant="secondary"
          icon="times"
          onClick={() => {
            setDrawerOpened(false);
            selectedTab === Tabs.QueryLibrary && queryLibraryTrackToggle(false);
          }}
        ></Button>
      ) : (
        <Dropdown overlay={menu} onVisibleChange={setIsOpen}>
          <ToolbarButton size="sm" isOpen={isOpen} narrow={true} variant="canvas" />
        </Dropdown>
      )}
    </ButtonGroup>
  );
}

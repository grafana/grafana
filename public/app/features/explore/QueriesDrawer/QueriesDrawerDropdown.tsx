import { css } from '@emotion/css';

import { Button, ButtonGroup, Dropdown, Menu, ToolbarButton } from '@grafana/ui';
import { useStyles2 } from '@grafana/ui/';

import { Tabs, useQueriesDrawerContext } from './QueriesDrawerContext';
import { i18n } from './utils';

type Props = {
  variant: 'compact' | 'full';
};

export function QueriesDrawerDropdown({ variant }: Props) {
  const { selectedTab, setSelectedTab, queryLibraryAvailable, drawerOpened, setDrawerOpened } =
    useQueriesDrawerContext();

  const styles = useStyles2(getStyles);

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

  return (
    <ButtonGroup>
      <ToolbarButton
        icon="book"
        variant={drawerOpened ? 'active' : 'canvas'}
        onClick={() => setDrawerOpened(!drawerOpened)}
        aria-label={selectedTab}
      >
        {variant === 'full' ? selectedTab : undefined}
      </ToolbarButton>
      {drawerOpened ? (
        <Button
          className={styles.close}
          variant="secondary"
          icon="times"
          onClick={() => setDrawerOpened(false)}
        ></Button>
      ) : (
        <Dropdown overlay={menu}>
          <ToolbarButton className={styles.toggle} variant="canvas" icon="angle-down" />
        </Dropdown>
      )}
    </ButtonGroup>
  );
}

const getStyles = () => ({
  toggle: css({ width: '36px' }),
  // tweaking icon position so it's nicely aligned when dropdown turns into a close button
  close: css({ width: '36px', '> svg': { position: 'relative', left: 2 } }),
});

import React, { ReactNode } from 'react';
import { Item } from '@react-stately/collections';
import { css, cx } from '@emotion/css';
import { GrafanaTheme2, locationUtil, NavMenuItemType, NavModelItem } from '@grafana/data';
import { IconName, useTheme2 } from '@grafana/ui';
import { locationService } from '@grafana/runtime';

import { NavBarMenuItem } from './NavBarMenuItem';
import { getNavBarItemWithoutMenuStyles, NavBarItemWithoutMenu } from './NavBarItemWithoutMenu';
import { NavBarItemMenuTrigger } from './NavBarItemMenuTrigger';
import { NavBarItemMenu } from './NavBarItemMenu';
import { getNavModelItemKey } from './utils';
import { defineMessage } from '@lingui/macro';
import { MessageDescriptor } from '@lingui/core';
import { useLingui } from '@lingui/react';

export interface Props {
  isActive?: boolean;
  children: ReactNode;
  className?: string;
  reverseMenuDirection?: boolean;
  showMenu?: boolean;
  link: NavModelItem;
}

// Maps the ID of the nav item to a translated phrase to later pass to <Trans />
// Because the navigation content is dynamic (defined in the backend), we can not use
// the normal inline message definition method.
// Keys MUST match the ID of the navigation item, defined in the backend.
// see pkg/api/index.go
const TRANSLATED_MENU_ITEMS: Record<string, MessageDescriptor> = {
  home: defineMessage({ id: 'nav.home', message: 'Home' }),

  create: defineMessage({ id: 'nav.create', message: 'Create' }),
  'create-dashboard': defineMessage({ id: 'nav.create-dashboard', message: 'Dashboard' }),
  folder: defineMessage({ id: 'nav.create-folder', message: 'Folder' }), // TODO: unique ID for new nav
  import: defineMessage({ id: 'nav.create-import', message: 'Import' }), // TODO: unique ID for new nav
  alert: defineMessage({ id: 'nav.create-alert', message: 'Alert rule' }),

  dashboards: defineMessage({ id: 'nav.dashboards', message: 'Dashboards' }),
  'manage-dashboards': defineMessage({ id: 'nav.manage-dashboards', message: 'Browse' }),
  playlists: defineMessage({ id: 'nav.playlists', message: 'Playlists' }),
  snapshots: defineMessage({ id: 'nav.snapshots', message: 'Snapshots' }),
  'library-panels': defineMessage({ id: 'nav.library-panels', message: 'Library panels' }),
  'new-dashboard': defineMessage({ id: 'nav.new-dashboard', message: 'New dashboard' }),
  'new-folder': defineMessage({ id: 'nav.new-folder', message: 'New folder' }),

  explore: defineMessage({ id: 'nav.explore', message: 'Explore' }),

  alerting: defineMessage({ id: 'nav.alerting', message: 'Alerting' }),
  'alert-list': defineMessage({ id: 'nav.alerting-list', message: 'Alert rules' }),
  receivers: defineMessage({ id: 'nav.alerting-receivers', message: 'Contact points' }),
  'am-routes': defineMessage({ id: 'nav.alerting-am-routes', message: 'Notification policies' }),
  channels: defineMessage({ id: 'nav.alerting-channels', message: 'Notification channels' }),

  silences: defineMessage({ id: 'nav.alerting-silences', message: 'Silences' }),
  groups: defineMessage({ id: 'nav.alerting-groups', message: 'Groups' }),
  'alerting-admin': defineMessage({ id: 'nav.alerting-admin', message: 'Admin' }),

  cfg: defineMessage({ id: 'nav.config', message: 'Configuration' }),
  datasources: defineMessage({ id: 'nav.datasources', message: 'Data sources' }),
  users: defineMessage({ id: 'nav.users', message: 'Users' }),
  teams: defineMessage({ id: 'nav.teams', message: 'Teams' }),
  plugins: defineMessage({ id: 'nav.plugins', message: 'Plugins' }),
  'org-settings': defineMessage({ id: 'nav.org-settings', message: 'Preferences' }),
  apikeys: defineMessage({ id: 'nav.api-keys', message: 'API keys' }),
  serviceaccounts: defineMessage({ id: 'nav.service-accounts', message: 'Service accounts' }),

  live: defineMessage({ id: 'nav.live', message: 'Event streaming' }),
  'live-status': defineMessage({ id: 'nav.live-status', message: 'Status' }),
  'live-pipeline': defineMessage({ id: 'nav.live-pipeline', message: 'Pipeline' }),
  'live-cloud': defineMessage({ id: 'nav.live-cloud', message: 'Cloud' }),

  help: defineMessage({ id: 'nav.help', message: 'Help' }),

  'profile-settings': defineMessage({ id: 'nav.profile-settings', message: 'Preferences' }),
  'change-password': defineMessage({ id: 'nav.change-password', message: 'Change password' }),
  'sign-out': defineMessage({ id: 'nav.sign-out', message: 'Sign out' }),
};

const NavBarItem = ({
  isActive = false,
  children,
  className,
  reverseMenuDirection = false,
  showMenu = true,
  link,
}: Props) => {
  const { i18n } = useLingui();
  const theme = useTheme2();
  const menuItems = link.children ?? [];
  const menuItemsSorted = reverseMenuDirection ? menuItems.reverse() : menuItems;
  const filteredItems = menuItemsSorted
    .filter((item) => !item.hideFromMenu)
    .map((i) => ({ ...i, menuItemType: NavMenuItemType.Item }));
  const adjustHeightForBorder = filteredItems.length === 0;
  const styles = getStyles(theme, adjustHeightForBorder, isActive);
  const section: NavModelItem = {
    ...link,
    children: filteredItems,
    menuItemType: NavMenuItemType.Section,
  };
  const items: NavModelItem[] = [section].concat(filteredItems);

  const onNavigate = (item: NavModelItem) => {
    const { url, target, onClick } = item;
    if (!url) {
      onClick?.();
      return;
    }

    if (!target && url.startsWith('/')) {
      locationService.push(locationUtil.stripBaseFromUrl(url));
    } else {
      window.open(url, target);
    }
  };

  const translationKey = link.id && TRANSLATED_MENU_ITEMS[link.id];
  const linkText = translationKey ? i18n._(translationKey) : link.text;

  return showMenu ? (
    <li className={cx(styles.container, className)}>
      <NavBarItemMenuTrigger item={section} isActive={isActive} label={linkText}>
        <NavBarItemMenu
          items={items}
          reverseMenuDirection={reverseMenuDirection}
          adjustHeightForBorder={adjustHeightForBorder}
          disabledKeys={['divider', 'subtitle']}
          aria-label={section.text}
          onNavigate={onNavigate}
        >
          {(item: NavModelItem) => {
            const translationKey = item.id && TRANSLATED_MENU_ITEMS[item.id];
            const itemText = translationKey ? i18n._(translationKey) : item.text;

            if (item.menuItemType === NavMenuItemType.Section) {
              return (
                <Item key={getNavModelItemKey(item)} textValue={item.text}>
                  <NavBarMenuItem
                    target={item.target}
                    text={itemText}
                    url={item.url}
                    onClick={item.onClick}
                    styleOverrides={styles.header}
                  />
                </Item>
              );
            }

            return (
              <Item key={getNavModelItemKey(item)} textValue={item.text}>
                <NavBarMenuItem
                  isDivider={item.divider}
                  icon={item.icon as IconName}
                  onClick={item.onClick}
                  target={item.target}
                  text={itemText}
                  url={item.url}
                  styleOverrides={styles.item}
                />
              </Item>
            );
          }}
        </NavBarItemMenu>
      </NavBarItemMenuTrigger>
    </li>
  ) : (
    <NavBarItemWithoutMenu
      label={link.text}
      className={className}
      isActive={isActive}
      url={link.url}
      onClick={link.onClick}
      target={link.target}
      highlightText={link.highlightText}
    >
      {children}
    </NavBarItemWithoutMenu>
  );
};

export default NavBarItem;

const getStyles = (theme: GrafanaTheme2, adjustHeightForBorder: boolean, isActive?: boolean) => ({
  ...getNavBarItemWithoutMenuStyles(theme, isActive),
  header: css`
    color: ${theme.colors.text.primary};
    height: ${theme.components.sidemenu.width - (adjustHeightForBorder ? 2 : 1)}px;
    font-size: ${theme.typography.h4.fontSize};
    font-weight: ${theme.typography.h4.fontWeight};
    padding: ${theme.spacing(1)} ${theme.spacing(2)};
    white-space: nowrap;
    width: 100%;
  `,
  item: css`
    color: ${theme.colors.text.primary};
  `,
});

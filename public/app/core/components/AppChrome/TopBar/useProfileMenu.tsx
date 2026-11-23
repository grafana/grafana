import { type ReactElement } from 'react';
import { useToggle } from 'react-use';

import { type NavModelItem, PluginExtensionPoints } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config, renderLimitedComponents } from '@grafana/runtime';
import { Menu, MenuItem } from '@grafana/ui';
import { SETUPGUIDE_PLUGIN_ID } from 'app/core/constants';
import { clearLoginSectionTitle } from 'app/core/services/loginSectionTitle';
import { usePluginComponents } from 'app/features/plugins/extensions/usePluginComponents';

import { ThemeSelectorDrawer } from '../../ThemeSelector/ThemeSelectorDrawer';
import { NewsContainer } from '../News/NewsDrawer';

import { TopNavBarMenu } from './TopNavBarMenu';

interface ProfileMenuOptions {
  profileNode: NavModelItem;
  onToggleKioskMode: () => void;
  /** Leaves out the header naming the user, for a trigger that already shows their name. */
  hideHeader?: boolean;
  /** Called when the user follows a link to one of their profile pages, for a menu that has to close with it. */
  onNavigate?: () => void;
}

interface ProfileMenu {
  /** Renders the menu, for a `Dropdown` overlay. */
  renderMenu: () => ReactElement;
  /** The theme and news drawers the menu opens. Render them beside the menu's trigger. */
  drawers: ReactElement;
}

/** The signed-in user's menu: their profile pages, theme, kiosk mode, news and signing out. */
export function useProfileMenu({
  profileNode,
  onToggleKioskMode,
  hideHeader,
  onNavigate,
}: ProfileMenuOptions): ProfileMenu {
  const [showNewsDrawer, onToggleShowNewsDrawer] = useToggle(false);
  const [showThemeDrawer, onToggleThemeDrawer] = useToggle(false);
  const { components } = usePluginComponents({
    extensionPointId: PluginExtensionPoints.UserProfileMenu,
  });

  const renderMenu = () => (
    <TopNavBarMenu node={profileNode} hideHeader={hideHeader} onNavigate={onNavigate}>
      <>
        <MenuItem icon="palette" onClick={onToggleThemeDrawer} label={t('profile.change-theme', 'Change theme')} />
        <Menu.Item
          icon="monitor"
          onClick={onToggleKioskMode}
          label={t('profile.enable-kiosk-mode', 'Enable kiosk mode')}
        />
        {config.newsFeedEnabled && (
          <MenuItem
            icon="rss"
            onClick={onToggleShowNewsDrawer}
            label={t('navigation.rss-button', 'Latest from the blog')}
          />
        )}
        {renderLimitedComponents({
          props: {},
          components,
          limit: 1,
          pluginId: SETUPGUIDE_PLUGIN_ID,
        })}
        {!config.auth.disableSignoutMenu && (
          <>
            <Menu.Divider />
            <MenuItem
              url={`${config.appSubUrl}/logout`}
              onClick={clearLoginSectionTitle}
              label={t('nav.sign-out.title', 'Sign out')}
              icon="arrow-from-right"
              target={'_self'}
            />
          </>
        )}
      </>
    </TopNavBarMenu>
  );

  const drawers = (
    <>
      {showNewsDrawer && <NewsContainer onClose={onToggleShowNewsDrawer} />}
      {showThemeDrawer && <ThemeSelectorDrawer onClose={onToggleThemeDrawer} />}
    </>
  );

  return { renderMenu, drawers };
}

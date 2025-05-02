import { css } from '@emotion/css';
import { cloneDeep } from 'lodash';
import { useToggle } from 'react-use';

import { GrafanaTheme2, NavModelItem } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Dropdown, Menu, MenuItem, ToolbarButton, useStyles2 } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { t } from 'app/core/internationalization';

import { ThemeSelectorDrawer } from '../../ThemeSelector/ThemeSelectorDrawer';
import { enrichWithInteractionTracking } from '../MegaMenu/utils';
import { NewsContainer } from '../News/NewsDrawer';

import { TopNavBarMenu } from './TopNavBarMenu';

export interface Props {
  profileNode: NavModelItem;
  onToggleKioskMode: () => void;
}

export function ProfileButton({ profileNode, onToggleKioskMode }: Props) {
  const styles = useStyles2(getStyles);
  const node = enrichWithInteractionTracking(cloneDeep(profileNode), false);
  const [showNewsDrawer, onToggleShowNewsDrawer] = useToggle(false);
  const [showThemeDrawer, onToggleThemeDrawer] = useToggle(false);

  if (!node) {
    return null;
  }

  const renderMenu = () => (
    <TopNavBarMenu node={profileNode}>
      <>
        {config.featureToggles.grafanaconThemes && (
          <MenuItem icon="palette" onClick={onToggleThemeDrawer} label={t('profile.change-theme', 'Change theme')} />
        )}
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
        <Menu.Divider />
        {!config.auth.disableSignoutMenu && (
          <MenuItem
            url={`${config.appSubUrl}/logout`}
            label={t('nav.sign-out.title', 'Sign out')}
            icon="arrow-from-right"
            target={'_self'}
          />
        )}
      </>
    </TopNavBarMenu>
  );

  return (
    <>
      <Dropdown overlay={renderMenu} placement="bottom-end">
        <ToolbarButton
          className={styles.profileButton}
          imgSrc={contextSrv.user.gravatarUrl}
          imgAlt="User avatar"
          aria-label={t('navigation.profile.aria-label', 'Profile')}
        />
      </Dropdown>
      {showNewsDrawer && <NewsContainer onClose={onToggleShowNewsDrawer} />}
      {showThemeDrawer && <ThemeSelectorDrawer onClose={onToggleThemeDrawer} />}
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    profileButton: css({
      padding: theme.spacing(0, 0.5),
      img: {
        borderRadius: theme.shape.radius.circle,
        height: '24px',
        marginRight: 0,
        width: '24px',
      },
    }),
  };
};

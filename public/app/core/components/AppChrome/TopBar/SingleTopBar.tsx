import { css, cx } from '@emotion/css';
import React, { memo } from 'react';

import { type GrafanaTheme2, type NavModelItem } from '@grafana/data';
import { Components } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { type ScopesContextValue } from '@grafana/runtime';
import {
  useFlagGrafanaMegaMenuPeekAndDock,
  useFlagGrafanaMegaMenuProfile,
  useFlagGrafanaVisualDesignRefresh,
} from '@grafana/runtime/internal';
import { Icon, Stack, ToolbarButton, useStyles2 } from '@grafana/ui';
import { MEGA_MENU_TOGGLE_ID } from 'app/core/constants';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { useHomeNav } from 'app/core/hooks/useHomeNav';
import { useMediaQueryMinWidth } from 'app/core/hooks/useMediaQueryMinWidth';
import { contextSrv } from 'app/core/services/context_srv';
import { ScopesSelector } from 'app/features/scopes/selector/ScopesSelector';
import { useSelector } from 'app/types/store';

import { HomeLogo } from '../../Branding/Branding';
import { Breadcrumbs } from '../../Breadcrumbs/Breadcrumbs';
import { buildBreadcrumbs } from '../../Breadcrumbs/utils';
import { AssistantToolbarButtons } from '../AssistantWorkspace/AssistantToolbarButtons';
import { ExtensionToolbarItem } from '../ExtensionSidebar/ExtensionToolbarItem';
import { LazyFeatureControlButton } from '../FeatureControl/LazyFeatureControl';
import { MegaMenuToggleIcon } from '../MegaMenu/MegaMenuToggleIcon';
import { focusMegaMenuOverlay } from '../MegaMenu/utils';
import { NavToolbarSeparator } from '../NavToolbar/NavToolbarSeparator';
import { QuickAdd } from '../QuickAdd/QuickAdd';

import { HelpTopBarButton } from './HelpTopBarButton';
import { NavRightButton } from './InviteUserButton';
import { ProfileButton } from './ProfileButton';
import { SignInLink } from './SignInLink';
import { SingleTopBarActions } from './SingleTopBarActions';
import { TopBarExtensionPoint } from './TopBarExtensionPoint';
import { TopSearchBarCommandPaletteTrigger } from './TopSearchBarCommandPaletteTrigger';
import { getChromeHeaderLevelHeight } from './useChromeHeaderHeight';

interface Props {
  sectionNav: NavModelItem;
  pageNav?: NavModelItem;
  onToggleMegaMenu(): void;
  onToggleKioskMode(): void;
  actions?: React.ReactNode;
  breadcrumbActions?: React.ReactNode;
  scopes?: ScopesContextValue | undefined;
  showToolbarLevel: boolean;
}

export const SingleTopBar = memo(function SingleTopBar({
  onToggleMegaMenu,
  onToggleKioskMode,
  pageNav,
  sectionNav,
  scopes,
  actions,
  breadcrumbActions,
  showToolbarLevel,
}: Props) {
  const visualRefreshEnabled = useFlagGrafanaVisualDesignRefresh();
  const { chrome } = useGrafana();
  const state = chrome.useState();
  const menuDockedAndOpen = !state.chromeless && state.megaMenuDocked && state.megaMenuOpen;
  const styles = useStyles2(getStyles, menuDockedAndOpen, visualRefreshEnabled);
  const profileNode = useSelector((state) => state.navIndex['profile']);
  // With grafana.megaMenuProfile the profile sits at the bottom of the mega menu instead.
  const profileInMegaMenu = useFlagGrafanaMegaMenuProfile();
  const homeNav = useHomeNav();
  const breadcrumbs = buildBreadcrumbs(sectionNav, pageNav, homeNav);
  const isSmallScreen = !useMediaQueryMinWidth('sm');
  const isLargeScreen = useMediaQueryMinWidth('lg');
  // Below this width the docked menu is hidden, so it is never docked.
  const canDockMenu = useMediaQueryMinWidth('xl');
  const peekAndDock = useFlagGrafanaMegaMenuPeekAndDock();
  const topLevelScopes = !showToolbarLevel && isLargeScreen && scopes?.state.enabled;

  const onMenuToggleClick = () => {
    if (canDockMenu) {
      chrome.setMegaMenuDocked(true);
      chrome.setMegaMenuOpen(true);
    } else if (chrome.state.getValue().megaMenuPeek) {
      // The menu the pointer opened stays open once clicked, instead of closing again, and takes focus as it does when
      // a click opens it.
      chrome.setMegaMenuOpen(true);
      focusMegaMenuOverlay();
    } else {
      onToggleMegaMenu();
    }
  };

  return (
    <>
      <div className={styles.layout}>
        <Stack minWidth={0} gap={0.5} alignItems="center" flex={{ xs: 2, lg: 1 }}>
          {!menuDockedAndOpen && (
            <>
              <HomeLogo homeNav={homeNav} />
              {peekAndDock ? (
                // Resting the pointer on it opens the menu over the page; a click docks the menu where the screen is
                // wide enough, and opens it over the page otherwise. The tooltip puts its own pointer handlers on the
                // button, so the wrapper listens for the pointer instead.
                <span
                  className={styles.menuToggleHoverArea}
                  onPointerEnter={(event) => event.pointerType === 'mouse' && chrome.startMegaMenuPeek()}
                  onPointerLeave={chrome.endMegaMenuPeek}
                >
                  <ToolbarButton
                    narrow
                    id={MEGA_MENU_TOGGLE_ID}
                    data-testid={Components.NavBar.Toggle.button}
                    onClick={onMenuToggleClick}
                    aria-label={t('navigation.megamenu.open', 'Main menu')}
                    tooltip={canDockMenu ? t('navigation.megamenu.click-to-dock', 'Click to dock') : undefined}
                    aria-expanded={state.megaMenuOpen}
                    className={cx(state.megaMenuOpen && styles.menuToggleActive)}
                  >
                    <MegaMenuToggleIcon />
                  </ToolbarButton>
                </span>
              ) : (
                <ToolbarButton
                  narrow
                  id={MEGA_MENU_TOGGLE_ID}
                  data-testid={Components.NavBar.Toggle.button}
                  onClick={onToggleMegaMenu}
                  tooltip={t('navigation.megamenu.open', 'Main menu')}
                  aria-expanded={state.megaMenuOpen}
                  className={cx(state.megaMenuOpen && styles.menuToggleActive)}
                >
                  <Stack gap={0} alignItems="center">
                    <Icon name="bars" size="xl" />
                  </Stack>
                </ToolbarButton>
              )}
            </>
          )}
          {topLevelScopes ? <ScopesSelector /> : undefined}
          <Breadcrumbs breadcrumbs={breadcrumbs} className={styles.breadcrumbsWrapper} />
          {!showToolbarLevel && breadcrumbActions}
        </Stack>

        <Stack
          gap={0.5}
          alignItems="center"
          justifyContent={'flex-end'}
          flex={1}
          data-testid={!showToolbarLevel ? Components.NavToolbar.container : undefined}
        >
          <TopBarExtensionPoint />
          <TopSearchBarCommandPaletteTrigger />
          {!isSmallScreen && <QuickAdd />}
          <LazyFeatureControlButton />
          <HelpTopBarButton isSmallScreen={isSmallScreen} />
          <NavToolbarSeparator />
          {!isSmallScreen && <ExtensionToolbarItem compact={isSmallScreen} />}
          {!showToolbarLevel && actions}
          <NavRightButton />
          <AssistantToolbarButtons />
          {profileNode && !profileInMegaMenu && (
            <ProfileButton profileNode={profileNode} onToggleKioskMode={onToggleKioskMode} />
          )}
          {!contextSrv.user.isSignedIn && <SignInLink />}
        </Stack>
      </div>
      {showToolbarLevel && (
        <SingleTopBarActions scopes={scopes} actions={actions} breadcrumbActions={breadcrumbActions} />
      )}
    </>
  );
});

const getStyles = (theme: GrafanaTheme2, menuDockedAndOpen: boolean, visualRefreshEnabled: boolean) => ({
  layout: css({
    height: getChromeHeaderLevelHeight(),
    display: 'flex',
    gap: theme.spacing(2),
    alignItems: 'center',
    padding: theme.spacing(0, 1),
    paddingLeft: menuDockedAndOpen ? theme.spacing(visualRefreshEnabled ? 0.5 : 3.5) : theme.spacing(1),
    borderBottom: visualRefreshEnabled ? undefined : `1px solid ${theme.colors.border.weak}`,
    justifyContent: 'space-between',
  }),
  breadcrumbsWrapper: css({
    display: 'flex',
    overflow: 'hidden',
    [theme.breakpoints.down('sm')]: {
      minWidth: '40%',
    },
  }),
  img: css({
    alignSelf: 'center',
    height: theme.spacing(3),
    width: theme.spacing(3),
  }),
  kioskToggle: css({
    [theme.breakpoints.down('lg')]: {
      display: 'none',
    },
  }),
  menuToggleHoverArea: css({
    display: 'inline-flex',
  }),
  menuToggleActive: css({
    backgroundColor: theme.colors.accent.transparent,
    color: theme.colors.accent.text,
    '&:hover': {
      backgroundColor: theme.colors.accent.transparent,
      color: theme.colors.accent.textEmphasis,
    },
  }),
});

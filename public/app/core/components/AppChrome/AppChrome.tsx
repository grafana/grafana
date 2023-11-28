import { css, cx } from '@emotion/css';
import classNames from 'classnames';
import React, { PropsWithChildren } from 'react';

import { GrafanaTheme2, PageLayoutType } from '@grafana/data';
import { useStyles2, LinkButton, useTheme2 } from '@grafana/ui';
import config from 'app/core/config';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { CommandPalette } from 'app/features/commandPalette/CommandPalette';
import { KioskMode } from 'app/types';

import { AppChromeMenu } from './AppChromeMenu';
import { MegaMenu as DockedMegaMenu } from './DockedMegaMenu/MegaMenu';
import { MegaMenu } from './MegaMenu/MegaMenu';
import { NavToolbar } from './NavToolbar/NavToolbar';
import { SectionNav } from './SectionNav/SectionNav';
import { TopSearchBar } from './TopBar/TopSearchBar';
import { TOP_BAR_LEVEL_HEIGHT } from './types';

export interface Props extends PropsWithChildren<{}> {}

export function AppChrome({ children }: Props) {
  const { chrome } = useGrafana();
  const state = chrome.useState();
  const searchBarHidden = state.searchBarHidden || state.kioskMode === KioskMode.TV;
  const theme = useTheme2();
  const styles = useStyles2(getStyles);

  const contentClass = cx({
    [styles.content]: true,
    [styles.contentNoSearchBar]: searchBarHidden,
    [styles.contentChromeless]: state.chromeless,
  });

  const handleMegaMenu = () => {
    switch (state.megaMenu) {
      case 'closed':
        chrome.setMegaMenu('open');
        break;
      case 'open':
        chrome.setMegaMenu('closed');
        break;
      case 'docked':
        // on desktop, clicking the button when the menu is docked should close the menu
        // on mobile, the docked menu is hidden, so clicking the button should open the menu
        const isDesktop = window.innerWidth > theme.breakpoints.values.md;
        isDesktop ? chrome.setMegaMenu('closed') : chrome.setMegaMenu('open');
        break;
    }
  };

  // Chromeless routes are without topNav, mega menu, search & command palette
  // We check chromeless twice here instead of having a separate path so {children}
  // doesn't get re-mounted when chromeless goes from true to false.
  return (
    <div
      className={classNames('main-view', {
        'main-view--search-bar-hidden': searchBarHidden && !state.chromeless,
        'main-view--chrome-hidden': state.chromeless,
      })}
    >
      {!state.chromeless && (
        <>
          <LinkButton className={styles.skipLink} href="#pageContent">
            Skip to main content
          </LinkButton>
          <div className={cx(styles.topNav)}>
            {!searchBarHidden && <TopSearchBar />}
            <NavToolbar
              searchBarHidden={searchBarHidden}
              sectionNav={state.sectionNav.node}
              pageNav={state.pageNav}
              actions={state.actions}
              onToggleSearchBar={chrome.onToggleSearchBar}
              onToggleMegaMenu={handleMegaMenu}
              onToggleKioskMode={chrome.onToggleKioskMode}
            />
          </div>
        </>
      )}
      <main className={contentClass}>
        <div className={styles.panes}>
          {state.layout === PageLayoutType.Standard && state.sectionNav && !config.featureToggles.dockedMegaMenu && (
            <SectionNav model={state.sectionNav} />
          )}
          {config.featureToggles.dockedMegaMenu && !state.chromeless && state.megaMenu === 'docked' && (
            <DockedMegaMenu className={styles.dockedMegaMenu} onClose={() => chrome.setMegaMenu('closed')} />
          )}
          <div className={styles.pageContainer} id="pageContent">
            {children}
          </div>
        </div>
      </main>
      {!state.chromeless && (
        <>
          {config.featureToggles.dockedMegaMenu ? (
            <AppChromeMenu />
          ) : (
            <MegaMenu searchBarHidden={searchBarHidden} onClose={() => chrome.setMegaMenu('closed')} />
          )}
          <CommandPalette />
        </>
      )}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  const shadow = theme.isDark
    ? `0 0.6px 1.5px rgb(0 0 0), 0 2px 4px rgb(0 0 0 / 40%), 0 5px 10px rgb(0 0 0 / 23%)`
    : '0 4px 8px rgb(0 0 0 / 4%)';

  return {
    content: css({
      display: 'flex',
      flexDirection: 'column',
      paddingTop: TOP_BAR_LEVEL_HEIGHT * 2,
      flexGrow: 1,
      height: '100%',
    }),
    contentNoSearchBar: css({
      paddingTop: TOP_BAR_LEVEL_HEIGHT,
    }),
    contentChromeless: css({
      paddingTop: 0,
    }),
    dockedMegaMenu: css({
      background: theme.colors.background.primary,
      borderRight: `1px solid ${theme.colors.border.weak}`,
      borderTop: `1px solid ${theme.colors.border.weak}`,
      display: 'none',
      zIndex: theme.zIndex.navbarFixed,

      [theme.breakpoints.up('md')]: {
        display: 'block',
      },
    }),
    topNav: css({
      display: 'flex',
      position: 'fixed',
      zIndex: theme.zIndex.navbarFixed,
      left: 0,
      right: 0,
      boxShadow: shadow,
      background: theme.colors.background.primary,
      flexDirection: 'column',
      borderBottom: `1px solid ${theme.colors.border.weak}`,
    }),
    panes: css({
      label: 'page-panes',
      display: 'flex',
      height: '100%',
      width: '100%',
      flexGrow: 1,
      minHeight: 0,
      flexDirection: 'column',
      [theme.breakpoints.up('md')]: {
        flexDirection: 'row',
      },
    }),
    pageContainer: css({
      label: 'page-container',
      flexGrow: 1,
      minHeight: 0,
      minWidth: 0,
    }),
    skipLink: css({
      position: 'absolute',
      top: -1000,

      ':focus': {
        left: theme.spacing(1),
        top: theme.spacing(1),
        zIndex: theme.zIndex.portal,
      },
    }),
  };
};

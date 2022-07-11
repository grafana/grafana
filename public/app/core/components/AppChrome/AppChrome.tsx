import { css, cx } from '@emotion/css';
import React, { PropsWithChildren, useState } from 'react';
import { useToggle } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import { useStyles2 } from '@grafana/ui';

import { MegaMenu } from '../MegaMenu/MegaMenu';

import { appChromeService } from './AppChromeService';
import { NavToolbar } from './NavToolbar';
import { TopSearchBar } from './TopSearchBar';
import { TOP_BAR_LEVEL_HEIGHT } from './types';

export interface Props extends PropsWithChildren<{}> {}

export function AppChrome({ children }: Props) {
  const styles = useStyles2(getStyles);
  const [searchBarHidden, toggleSearchBar] = useToggle(false); // repace with local storage
  const [megaMenuOpen, setMegaMenuOpen] = useState(false);
  const state = appChromeService.useState();

  if (state.chromeless || !config.featureToggles.topnav) {
    return <main className="main-view">{children} </main>;
  }

  return (
    <main className="main-view">
      <div className={styles.topNav}>
        {!searchBarHidden && <TopSearchBar />}
        <NavToolbar
          searchBarHidden={searchBarHidden}
          sectionNav={state.sectionNav}
          pageNav={state.pageNav}
          actions={state.actions}
          onToggleSearchBar={toggleSearchBar}
          onToggleMegaMenu={() => setMegaMenuOpen(!megaMenuOpen)}
        />
      </div>
      <div className={cx(styles.content, searchBarHidden && styles.contentNoSearchBar)}>{children}</div>
      {megaMenuOpen && <MegaMenu searchBarHidden={searchBarHidden} onClose={() => setMegaMenuOpen(false)} />}
    </main>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  const shadow = theme.isDark
    ? `0 0.6px 1.5px rgb(0 0 0), 0 2px 4px rgb(0 0 0 / 40%), 0 5px 10px rgb(0 0 0 / 23%)`
    : '0 0.6px 1.5px rgb(0 0 0 / 8%), 0 2px 4px rgb(0 0 0 / 6%), 0 5px 10px rgb(0 0 0 / 5%)';

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
    topNav: css({
      display: 'flex',
      position: 'fixed',
      zIndex: theme.zIndex.navbarFixed,
      left: 0,
      right: 0,
      boxShadow: shadow,
      background: theme.colors.background.primary,
      flexDirection: 'column',
    }),
  };
};

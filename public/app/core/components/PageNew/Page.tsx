// Libraries
import { css, cx } from '@emotion/css';
import React, { useEffect, useState } from 'react';
import { useLocalStorage } from 'react-use';

import { GrafanaTheme2, PageLayoutType } from '@grafana/data';
import { CustomScrollbar, useStyles2, useTheme2 } from '@grafana/ui';
import { useGrafana } from 'app/core/context/GrafanaContext';

import { Footer } from '../Footer/Footer';
import { PageType } from '../Page/types';
import { usePageNav } from '../Page/usePageNav';
import { usePageTitle } from '../Page/usePageTitle';

import { PageContents } from './PageContents';
import { PageHeader } from './PageHeader';
import { PageTabs } from './PageTabs';
import { SectionNav } from './SectionNav';
import { SectionNavToggle } from './SectionNavToggle';

export const Page: PageType = ({
  navId,
  navModel: oldNavProp,
  pageNav,
  subTitle,
  children,
  className,
  layout = PageLayoutType.Standard,
  toolbar,
  scrollTop,
  scrollRef,
  ...otherProps
}) => {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);
  const navModel = usePageNav(navId, oldNavProp);
  const { chrome } = useGrafana();

  const isSmallScreen = window.matchMedia(`(max-width: ${theme.breakpoints.values.lg}px)`).matches;
  const [navExpandedPreference, setNavExpandedPreference] = useLocalStorage<boolean>(
    'grafana.sectionNav.expanded',
    !isSmallScreen
  );
  const [isNavExpanded, setNavExpanded] = useState(!isSmallScreen && navExpandedPreference);

  usePageTitle(navModel, pageNav);

  const pageHeaderNav = pageNav ?? navModel?.node;

  useEffect(() => {
    const mediaQuery = window.matchMedia(`(max-width: ${theme.breakpoints.values.lg}px)`);
    const onMediaQueryChange = (e: MediaQueryListEvent) => setNavExpanded(e.matches ? false : navExpandedPreference);
    mediaQuery.addEventListener('change', onMediaQueryChange);
    return () => mediaQuery.removeEventListener('change', onMediaQueryChange);
  }, [navExpandedPreference, theme.breakpoints.values.lg]);

  useEffect(() => {
    if (navModel) {
      chrome.update({
        sectionNav: navModel.node,
        pageNav: pageNav,
      });
    }
  }, [navModel, pageNav, chrome]);

  const onToggleSectionNav = () => {
    setNavExpandedPreference(!isNavExpanded);
    setNavExpanded(!isNavExpanded);
  };

  return (
    <div className={cx(styles.wrapper, className)} {...otherProps}>
      {layout === PageLayoutType.Standard && (
        <div className={styles.panes}>
          {navModel && (
            <>
              <SectionNav model={navModel} isExpanded={Boolean(isNavExpanded)} />
              <SectionNavToggle
                className={styles.collapseIcon}
                isExpanded={Boolean(isNavExpanded)}
                onClick={onToggleSectionNav}
              />
            </>
          )}
          <div className={styles.pageContainer}>
            <CustomScrollbar autoHeightMin={'100%'} scrollTop={scrollTop} scrollRefCallback={scrollRef}>
              <div className={styles.pageInner}>
                {pageHeaderNav && <PageHeader navItem={pageHeaderNav} subTitle={subTitle} />}
                {pageNav && pageNav.children && <PageTabs navItem={pageNav} />}
                <div className={styles.pageContent}>{children}</div>
              </div>
              <Footer />
            </CustomScrollbar>
          </div>
        </div>
      )}
      {layout === PageLayoutType.Canvas && (
        <CustomScrollbar autoHeightMin={'100%'} scrollTop={scrollTop} scrollRefCallback={scrollRef}>
          <div className={styles.canvasContent}>
            {toolbar}
            {children}
          </div>
        </CustomScrollbar>
      )}
      {layout === PageLayoutType.Custom && (
        <>
          {toolbar}
          {children}
        </>
      )}
    </div>
  );
};

const OldNavOnly = () => null;
OldNavOnly.displayName = 'OldNavOnly';

Page.Header = PageHeader;
Page.Contents = PageContents;
Page.OldNavOnly = OldNavOnly;

const getStyles = (theme: GrafanaTheme2) => {
  const shadow = theme.isDark
    ? `0 0.6px 1.5px -1px rgb(0 0 0),0 2px 4px -1px rgb(0 0 0 / 40%),0 5px 10px -1px rgb(0 0 0 / 23%)`
    : '0 0.6px 1.5px -1px rgb(0 0 0 / 8%),0 2px 4px rgb(0 0 0 / 6%),0 5px 10px -1px rgb(0 0 0 / 5%)';

  return {
    collapseIcon: css({
      border: `1px solid ${theme.colors.border.weak}`,
      transform: 'translateX(50%)',
      top: theme.spacing(8),
      right: theme.spacing(-1),

      [theme.breakpoints.down('md')]: {
        left: '50%',
        transform: 'translate(-50%, 50%) rotate(90deg)',
        top: theme.spacing(2),
      },
    }),
    wrapper: css({
      label: 'page-wrapper',
      height: '100%',
      display: 'flex',
      flex: '1 1 0',
      flexDirection: 'column',
      minHeight: 0,
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
    }),
    pageContent: css({
      label: 'page-content',
      flexGrow: 1,
    }),
    pageInner: css({
      label: 'page-inner',
      padding: theme.spacing(3),
      boxShadow: shadow,
      background: theme.colors.background.primary,
      margin: theme.spacing(2, 2, 2, 1),
      display: 'flex',
      flexDirection: 'column',
      flexGrow: 1,
    }),
    canvasContent: css({
      label: 'canvas-content',
      display: 'flex',
      flexDirection: 'column',
      padding: theme.spacing(2),
      flexBasis: '100%',
      flexGrow: 1,
    }),
  };
};

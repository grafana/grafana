// Libraries
import { css, cx } from '@emotion/css';
import React, { useEffect } from 'react';

import { GrafanaTheme2, PageLayoutType } from '@grafana/data';
import { CustomScrollbar, useStyles2 } from '@grafana/ui';
import { useGrafana } from 'app/core/context/GrafanaContext';

import { Footer } from '../Footer/Footer';
import { PageType } from '../Page/types';
import { usePageNav } from '../Page/usePageNav';
import { usePageTitle } from '../Page/usePageTitle';

import { PageContents } from './PageContents';
import { PageHeader } from './PageHeader';
import { PageTabs } from './PageTabs';
import { SectionNav } from './SectionNav';

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
  const styles = useStyles2(getStyles);
  const navModel = usePageNav(navId, oldNavProp);
  const { chrome } = useGrafana();

  usePageTitle(navModel, pageNav);

  const pageHeaderNav = pageNav ?? navModel?.node;

  useEffect(() => {
    if (navModel) {
      chrome.update({
        sectionNav: navModel.node,
        pageNav: pageNav,
      });
    }
  }, [navModel, pageNav, chrome]);

  return (
    <div className={cx(styles.wrapper, className)} {...otherProps}>
      {layout === PageLayoutType.Standard && (
        <div className={styles.panes}>
          {navModel && navModel.main.children && <SectionNav model={navModel} />}
          <div className={styles.pageContent}>
            <CustomScrollbar autoHeightMin={'100%'} scrollTop={scrollTop} scrollRefCallback={scrollRef}>
              <div className={styles.pageInner}>
                {pageHeaderNav && <PageHeader navItem={pageHeaderNav} subTitle={subTitle} />}
                {pageNav && pageNav.children && <PageTabs navItem={pageNav} />}
                {children}
              </div>
              <Footer />
            </CustomScrollbar>
          </div>
        </div>
      )}
      {layout === PageLayoutType.Canvas && (
        <CustomScrollbar autoHeightMin={'100%'} scrollTop={scrollTop} scrollRefCallback={scrollRef}>
          <div className={styles.dashboardContent}>
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
    wrapper: css`
      height: 100%;
      display: flex;
      flex: 1 1 0;
      flex-direction: column;
      min-height: 0;
    `,
    panes: css({
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
    pageContent: css({
      flexGrow: 1,
    }),
    pageInner: css({
      padding: theme.spacing(3),
      boxShadow: shadow,
      background: theme.colors.background.primary,
      margin: theme.spacing(2, 2, 2, 1),
      display: 'flex',
      flexDirection: 'column',
      flexGrow: 1,
    }),
    dashboardContent: css({
      display: 'flex',
      flexDirection: 'column',
      padding: theme.spacing(2),
      flexBasis: '100%',
      flexGrow: 1,
    }),
  };
};

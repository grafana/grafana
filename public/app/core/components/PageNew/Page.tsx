// Libraries
import { css, cx } from '@emotion/css';
import React, { useEffect } from 'react';

import { GrafanaTheme2, PageLayoutType } from '@grafana/data';
import { CustomScrollbar, useStyles2 } from '@grafana/ui';
import { useGrafana } from 'app/core/context/GrafanaContext';

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
  renderTitle,
  actions,
  subTitle,
  children,
  className,
  info,
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
          {navModel && <SectionNav model={navModel} />}
          <div className={styles.pageContainer}>
            <CustomScrollbar autoHeightMin={'100%'} scrollTop={scrollTop} scrollRefCallback={scrollRef}>
              <div className={styles.pageInner}>
                {pageHeaderNav && (
                  <PageHeader
                    actions={actions}
                    navItem={pageHeaderNav}
                    renderTitle={renderTitle}
                    info={info}
                    subTitle={subTitle}
                  />
                )}
                {pageNav && pageNav.children && <PageTabs navItem={pageNav} />}
                <div className={styles.pageContent}>{children}</div>
              </div>
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

Page.Contents = PageContents;

Page.OldNavOnly = function OldNavOnly() {
  return null;
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
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
      padding: theme.spacing(2),
      borderRadius: theme.shape.borderRadius(1),
      border: `1px solid ${theme.colors.border.weak}`,
      background: theme.colors.background.primary,
      display: 'flex',
      flexDirection: 'column',
      flexGrow: 1,
      margin: theme.spacing(0, 0, 0, 0),

      [theme.breakpoints.up('sm')]: {
        margin: theme.spacing(0, 1, 1, 1),
      },
      [theme.breakpoints.up('md')]: {
        margin: theme.spacing(2, 2, 2, 1),
        padding: theme.spacing(3),
      },
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

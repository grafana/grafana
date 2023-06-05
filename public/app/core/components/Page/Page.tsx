// Libraries
import { css, cx } from '@emotion/css';
import React, { useEffect } from 'react';

import { GrafanaTheme2, PageLayoutType } from '@grafana/data';
import { config } from '@grafana/runtime';
import { CustomScrollbar, useStyles2 } from '@grafana/ui';
import { useGrafana } from 'app/core/context/GrafanaContext';

import { Footer } from '../Footer/Footer';
import { PageHeader } from '../PageHeader/PageHeader';
import { Page as NewPage } from '../PageNew/Page';

import { PageContents } from './PageContents';
import { PageType } from './types';
import { usePageNav } from './usePageNav';
import { usePageTitle } from './usePageTitle';

export const OldPage: PageType = ({
  navId,
  navModel: oldNavProp,
  pageNav,
  children,
  className,
  toolbar,
  scrollRef,
  scrollTop,
  layout = PageLayoutType.Standard,
  renderTitle,
  subTitle,
  actions,
  info,
  ...otherProps
}) => {
  const styles = useStyles2(getStyles);
  const navModel = usePageNav(navId, oldNavProp);
  const { chrome } = useGrafana();

  usePageTitle(navModel, pageNav);

  const pageHeaderNav = pageNav ?? navModel?.main;

  useEffect(() => {
    if (navModel) {
      // This is needed for chrome to update it's chromeless state
      chrome.update({
        sectionNav: navModel,
      });
    } else {
      // Need to trigger a chrome state update for the route change to be processed
      chrome.update({});
    }
  }, [navModel, chrome]);

  return (
    <div className={cx(styles.wrapper, className)} {...otherProps}>
      {layout === PageLayoutType.Standard && (
        <CustomScrollbar autoHeightMin={'100%'} scrollTop={scrollTop} scrollRefCallback={scrollRef}>
          <div className={cx('page-scrollbar-content', className)}>
            {pageHeaderNav && (
              <PageHeader
                actions={actions}
                info={info}
                navItem={pageHeaderNav}
                renderTitle={renderTitle}
                subTitle={subTitle}
              />
            )}
            {children}
            <Footer />
          </div>
        </CustomScrollbar>
      )}
      {layout === PageLayoutType.Canvas && (
        <>
          {toolbar}
          <div className={styles.scrollWrapper}>
            <CustomScrollbar autoHeightMin={'100%'} scrollTop={scrollTop} scrollRefCallback={scrollRef}>
              <div className={cx(styles.content, !toolbar && styles.contentWithoutToolbar)}>{children}</div>
            </CustomScrollbar>
          </div>
        </>
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

OldPage.Contents = PageContents;

export const Page: PageType = config.featureToggles.topnav ? NewPage : OldPage;

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    width: '100%',
    height: '100%',
    display: 'flex',
    flex: '1 1 0',
    flexDirection: 'column',
    minHeight: 0,
  }),
  scrollWrapper: css({
    width: '100%',
    flexGrow: 1,
    minHeight: 0,
    display: 'flex',
  }),
  content: css({
    display: 'flex',
    flexDirection: 'column',
    padding: theme.spacing(0, 2, 2, 2),
    flexBasis: '100%',
    flexGrow: 1,
  }),
  contentWithoutToolbar: css({
    padding: theme.spacing(2),
  }),
});

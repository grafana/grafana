// Libraries
import { css, cx } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, PageLayoutType } from '@grafana/data';
import { config } from '@grafana/runtime';
import { CustomScrollbar, useStyles2 } from '@grafana/ui';

import { Footer } from '../Footer/Footer';
import { PageHeader } from '../PageHeader/PageHeader';
import { Page as NewPage } from '../PageNew/Page';

import { OldNavOnly } from './OldNavOnly';
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
}) => {
  const styles = useStyles2(getStyles);
  const navModel = usePageNav(navId, oldNavProp);

  usePageTitle(navModel, pageNav);

  const pageHeaderNav = pageNav ?? navModel?.main;

  return (
    <div className={cx(styles.wrapper, className)}>
      {layout === PageLayoutType.Standard && (
        <CustomScrollbar autoHeightMin={'100%'} scrollTop={scrollTop} scrollRefCallback={scrollRef}>
          <div className="page-scrollbar-content">
            {pageHeaderNav && <PageHeader navItem={pageHeaderNav} />}
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
    </div>
  );
};

OldPage.Header = PageHeader;
OldPage.Contents = PageContents;
OldPage.OldNavOnly = OldNavOnly;

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

// Libraries
import { css, cx } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import { CustomScrollbar, useStyles2 } from '@grafana/ui';

import { Footer } from '../Footer/Footer';
import { PageHeader } from '../PageHeader/PageHeader';
import { Page as NewPage } from '../PageNew/Page';

import { PageContents } from './PageContents';
import { PageType } from './types';
import { usePageNav } from './usePageNav';
import { usePageTitle } from './usePageTitle';

export const OldPage: PageType = ({ navId, navModel: oldNavProp, pageNav, children, className, ...otherProps }) => {
  const styles = useStyles2(getStyles);
  const navModel = usePageNav(navId, oldNavProp);

  usePageTitle(navModel, pageNav);

  const pageHeaderNav = pageNav ?? navModel?.main;

  return (
    <div {...otherProps} className={cx(styles.wrapper, className)}>
      <CustomScrollbar autoHeightMin={'100%'}>
        <div className="page-scrollbar-content">
          {pageHeaderNav && <PageHeader navItem={pageHeaderNav} />}
          {children}
          <Footer />
        </div>
      </CustomScrollbar>
    </div>
  );
};

OldPage.Header = PageHeader;
OldPage.Contents = PageContents;

export const Page: PageType = config.featureToggles.topnav ? NewPage : OldPage;

const getStyles = (_: GrafanaTheme2) => ({
  wrapper: css`
    width: 100%;
    flex-grow: 1;
    min-height: 0;
  `,
});

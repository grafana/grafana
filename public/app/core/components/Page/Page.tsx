// Libraries
import { css, cx } from '@emotion/css';
import React, { FC, HTMLAttributes } from 'react';

import { GrafanaTheme2, NavModel, NavModelItem } from '@grafana/data';
import { config } from '@grafana/runtime';
import { CustomScrollbar, useStyles2 } from '@grafana/ui';

import { Footer } from '../Footer/Footer';
import { PageHeader } from '../PageHeader/PageHeader';
import { NewPage } from '../PageLayouts/NewPage';

import { PageContents } from './PageContents';
import { usePageNav } from './usePageNav';
import { usePageTitle } from './usePageTitle';

interface Props extends HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  navId?: string;
  navModel?: NavModel;
  pageNav?: NavModelItem;
}

export interface PageType extends FC<Props> {
  Header: typeof PageHeader;
  Contents: typeof PageContents;
}

export const OldPage: PageType = ({ navId, navModel: oldNavProp, pageNav, children, className, ...otherProps }) => {
  const styles = useStyles2(getStyles);
  const navModel = usePageNav(navId, oldNavProp);

  usePageTitle(navModel, pageNav);

  return (
    <div {...otherProps} className={cx(styles.wrapper, className)}>
      <CustomScrollbar autoHeightMin={'100%'}>
        <div className="page-scrollbar-content">
          <PageHeader navItem={pageNav ?? navModel.main} />
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

// Libraries
import { css, cx } from '@emotion/css';
import React, { HTMLAttributes, useEffect, FC } from 'react';

import { GrafanaTheme2, NavModel, NavModelItem } from '@grafana/data';
import { CustomScrollbar, useStyles2 } from '@grafana/ui';
import { getTitleFromNavModel } from 'app/core/selectors/navModel';

// Components
import { Branding } from '../Branding/Branding';
import { Footer } from '../Footer/Footer';

import { PageContents } from './PageContents';
import { PageHeader } from './PageHeader';
import { PageTabs } from './PageTabs';
import { SectionNav } from './SectionNav';

interface Props extends HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  navModel?: NavModel;
  pageNav?: NavModelItem;
}

export interface PageType extends FC<Props> {
  Header: typeof PageHeader;
  Contents: typeof PageContents;
}

export const NewPage: PageType = ({ navModel, pageNav, children, className, ...otherProps }: Props) => {
  const styles = useStyles2(getStyles);

  useEffect(() => {
    if (navModel) {
      const title = getTitleFromNavModel(navModel);
      document.title = title ? `${title} - ${Branding.AppTitle}` : Branding.AppTitle;
    } else {
      document.title = Branding.AppTitle;
    }
  }, [navModel]);

  if (!navModel) {
    return null;
  }

  return (
    <div {...otherProps} className={cx(styles.wrapper, className)}>
      <div className={styles.panes}>
        {navModel.main.children && <SectionNav model={navModel} />}
        <div className={styles.pageContent}>
          <CustomScrollbar autoHeightMin={'100%'}>
            <div className={styles.pageInner}>
              <PageHeader navItem={pageNav ?? navModel.main} />
              {pageNav && pageNav.children && <PageTabs navItem={pageNav} />}
              {children}
            </div>
            <Footer />
          </CustomScrollbar>
        </div>
      </div>
    </div>
  );
};

NewPage.Header = PageHeader;
NewPage.Contents = PageContents;

const getStyles = (theme: GrafanaTheme2) => {
  const style1 = window.location.href.indexOf('style=1') > -1;
  const margin = style1 ? theme.spacing(1, 1, 0, 1) : theme.spacing(2, 2, 2, 1);
  const border = style1 ? `1px solid ${theme.colors.border.weak}` : 'none';

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
      margin: margin,
      border: border,
      display: 'flex',
      flexDirection: 'column',
      flexGrow: 1,
    }),
  };
};

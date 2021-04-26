// Libraries
import React, { FC, HTMLAttributes, useEffect } from 'react';
import { getTitleFromNavModel } from 'app/core/selectors/navModel';

// Components
import PageHeader from '../PageHeader/PageHeader';
import { Footer } from '../Footer/Footer';
import { PageContents } from './PageContents';
import { CustomScrollbar, useStyles2 } from '@grafana/ui';
import { GrafanaThemeV2, NavModel, ThemeBreakpointsKey } from '@grafana/data';
import { Branding } from '../Branding/Branding';
import { css, cx } from '@emotion/css';

interface Props extends HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  navModel: NavModel;
  contentWidth?: ThemeBreakpointsKey;
}

export interface PageType extends FC<Props> {
  Header: typeof PageHeader;
  Contents: typeof PageContents;
}

export const Page: PageType = ({ navModel, children, className, contentWidth, ...otherProps }) => {
  const styles = useStyles2(getStyles);

  useEffect(() => {
    const title = getTitleFromNavModel(navModel);
    document.title = title ? `${title} - ${Branding.AppTitle}` : Branding.AppTitle;
  }, [navModel]);

  return (
    <div
      {...otherProps}
      className={cx(styles.wrapper, className, contentWidth ? styles.contentWidth(contentWidth) : undefined)}
    >
      <CustomScrollbar autoHeightMin={'100%'}>
        <div className="page-scrollbar-content">
          <PageHeader model={navModel} />
          {children}
          <Footer />
        </div>
      </CustomScrollbar>
    </div>
  );
};

Page.Header = PageHeader;
Page.Contents = PageContents;

export default Page;

const getStyles = (theme: GrafanaThemeV2) => ({
  wrapper: css`
    position: absolute;
    top: 0;
    bottom: 0;
    width: 100%;
    background: ${theme.colors.background.canvas};
  `,
  contentWidth: (size: ThemeBreakpointsKey) => css`
    .page-container {
      max-width: ${theme.breakpoints.values[size]};
    }
  `,
});

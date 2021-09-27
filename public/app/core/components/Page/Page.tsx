// Libraries
import React, { FC, HTMLAttributes, useEffect } from 'react';
import { getTitleFromNavModel } from 'app/core/selectors/navModel';

// Components
import PageHeader from '../PageHeader/PageHeader';
import { Footer } from '../Footer/Footer';
import { PageContents } from './PageContents';
import { CustomScrollbar, useStyles2 } from '@grafana/ui';
import { GrafanaTheme2, NavModel } from '@grafana/data';
import { Branding } from '../Branding/Branding';
import { css, cx } from '@emotion/css';

interface Props extends HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  navModel?: NavModel;
}

export interface PageType extends FC<Props> {
  Header: typeof PageHeader;
  Contents: typeof PageContents;
}

export const Page: PageType = ({ navModel, children, className, ...otherProps }) => {
  const styles = useStyles2(getStyles);

  useEffect(() => {
    if (navModel) {
      const title = getTitleFromNavModel(navModel);
      document.title = title ? `${title} - ${Branding.AppTitle}` : Branding.AppTitle;
    } else {
      document.title = Branding.AppTitle;
    }
  }, [navModel]);

  return (
    <div {...otherProps} className={cx(styles.wrapper, className)}>
      <CustomScrollbar autoHeightMin={'100%'}>
        <div className="page-scrollbar-content">
          {navModel && <PageHeader model={navModel} />}
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

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css`
    width: 100%;
    flex-grow: 1;
    width: 100%;
    min-height: 0;
  `,
});

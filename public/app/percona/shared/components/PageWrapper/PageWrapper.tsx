import React, { FC } from 'react';
import { useStyles } from '@grafana/ui';
import { locationUtil } from '@grafana/data';
import { Breadcrumb } from 'app/core/components/Breadcrumb';
import { usePageTitle } from '../hooks/pageTitle.hook';
import { getStyles } from './PageWrapper.styles';
import { PageWrapperProps } from './PageWrapper.types';

const PageWrapper: FC<PageWrapperProps> = ({ children, pageModel, dataQa = 'page-wrapper' }) => {
  const styles = useStyles(getStyles);
  const locationPath = locationUtil.stripBaseFromUrl(document.location.pathname);
  const currentLocation = locationPath.slice(1);
  usePageTitle(pageModel.title);

  return (
    <div className={styles.wrapper} data-qa={dataQa}>
      <Breadcrumb pageModel={pageModel} currentLocation={currentLocation} />
      {children}
    </div>
  );
};

export default PageWrapper;

import React, { FC } from 'react';

import { PageToolbar, useStyles } from '@grafana/ui/src';

import { FeatureLoader } from '../../../shared/components/Elements/FeatureLoader';

import { getStyles } from './DBaaSPage.styles';
import { DBaaSPageProps } from './DBaaSPage.types';
import DBaaSPageButtons from './DBaaSPageButtons/DBaaSPageButtons';
import { PageHeader } from './PageHeader/PageHeader';

export const DBaaSPage: FC<DBaaSPageProps> = ({
  pageToolbarProps,
  pageName,
  cancelUrl,
  submitBtnProps,
  pageHeader,
  children,
  featureLoaderProps,
}) => {
  const styles = useStyles(getStyles);

  return (
    <>
      <PageToolbar className={styles.pageToolbarWrapper} {...pageToolbarProps}>
        <DBaaSPageButtons pageName={pageName} cancelUrl={cancelUrl} submitBtnProps={submitBtnProps} />
      </PageToolbar>
      <PageHeader header={pageHeader} />
      <FeatureLoader {...featureLoaderProps}>
        <div className={styles.pageContent}>{children}</div>
      </FeatureLoader>
    </>
  );
};

export default DBaaSPage;

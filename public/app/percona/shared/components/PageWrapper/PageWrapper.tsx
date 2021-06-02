import React, { FC } from 'react';
import { useStyles } from '@grafana/ui';
import { Breadcrumb } from 'app/core/components/Breadcrumb';
import { getStyles } from './PageWrapper.styles';
import { PageWrapperProps } from './PageWrapper.types';

const PageWrapper: FC<PageWrapperProps> = ({ children, pageModel }) => {
  const styles = useStyles(getStyles);

  return (
    <div className={styles.wrapper}>
      <Breadcrumb pageModel={pageModel} />
      {children}
    </div>
  );
};

export default PageWrapper;

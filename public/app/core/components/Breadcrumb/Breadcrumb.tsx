import React, { FC } from 'react';
import { useStyles } from '@grafana/ui';
import { getStyles } from './Breadcrumb.styles';
import { BreadcrumbSections } from './BreadcrumbSections';
import { BreadcrumbProps } from './Breadcrumb.types';

export const Breadcrumb: FC<BreadcrumbProps> = ({ pageModel }) => {
  const styles = useStyles(getStyles);

  return (
    <div data-qa="breadcrumb" className={styles.breadcrumb}>
      <BreadcrumbSections pageModel={pageModel} />
    </div>
  );
};

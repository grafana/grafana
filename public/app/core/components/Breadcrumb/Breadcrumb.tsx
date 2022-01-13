import React, { FC } from 'react';

import { useStyles } from '@grafana/ui';

import { getStyles } from './Breadcrumb.styles';
import { BreadcrumbProps } from './Breadcrumb.types';
import { BreadcrumbSections } from './BreadcrumbSections';

export const Breadcrumb: FC<BreadcrumbProps> = ({ pageModel }) => {
  const styles = useStyles(getStyles);

  return (
    <div data-qa="breadcrumb" className={styles.breadcrumb}>
      <BreadcrumbSections pageModel={pageModel} />
    </div>
  );
};

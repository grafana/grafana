import React, { FC } from 'react';

import { useStyles } from '@grafana/ui';

import { getStyles } from './Breadcrumb.styles';
import { BreadcrumbProps } from './Breadcrumb.types';
import { BreadcrumbSections } from './BreadcrumbSections';

export const Breadcrumb: FC<BreadcrumbProps> = ({ pageModel, currentLocation }) => {
  const styles = useStyles(getStyles);

  return (
    <div data-testid="breadcrumb" className={styles.breadcrumb}>
      <BreadcrumbSections pageModel={pageModel} currentLocation={currentLocation} />
    </div>
  );
};

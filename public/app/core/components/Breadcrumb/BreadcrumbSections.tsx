import React, { FC } from 'react';
import { cx } from 'emotion';
import { useStyles } from '@grafana/ui';
import { getStyles } from './Breadcrumb.styles';
import { BreadcrumbProps } from './Breadcrumb.types';

export const BreadcrumbSections: FC<BreadcrumbProps> = ({ pageModel, currentLocation }) => {
  const styles = useStyles(getStyles);
  const { title, path: modelPath, children } = pageModel;

  const isCurrentPage = currentLocation === modelPath;
  const activeChild = children?.find(
    (child) => currentLocation.startsWith(`${child.path}/`) || currentLocation === child.path
  );

  return (
    <span data-qa="breadcrumb-section" className={cx(isCurrentPage && styles.currentPage)}>
      {isCurrentPage ? (
        title
      ) : (
        <a data-qa="breadcrumb-section-link" className={styles.link} href={modelPath}>
          {title}
        </a>
      )}
      {activeChild ? (
        <>
          {' / '}
          <BreadcrumbSections pageModel={activeChild} currentLocation={currentLocation} />
        </>
      ) : null}
    </span>
  );
};

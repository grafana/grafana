import React, { FC } from 'react';
import { cx } from 'emotion';
import { useSelector } from 'react-redux';
import { useStyles } from '@grafana/ui';
import { StoreState } from 'app/types';
import { getStyles } from './Breadcrumb.styles';
import { BreadcrumbProps } from './Breadcrumb.types';

export const BreadcrumbSections: FC<BreadcrumbProps> = ({ pageModel }) => {
  const styles = useStyles(getStyles);
  const locationPath = useSelector((state: StoreState) => state.location.path);
  const currentLocation = locationPath.slice(1);
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
          <BreadcrumbSections pageModel={activeChild} />
        </>
      ) : null}
    </span>
  );
};

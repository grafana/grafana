// Libraries
import { cx } from '@emotion/css';
import React, { FC } from 'react';

// Components
import PageLoader from '../PageLoader/PageLoader';

interface Props {
  isLoading?: boolean;
  children: React.ReactNode;
  className?: string;
  dataTestId?: string;
}

export const PageContents: FC<Props> = ({ isLoading, children, className, dataTestId }) => {
  return (
    <div data-testid={dataTestId} className={cx('page-container', 'page-body', className)}>
      {isLoading ? <PageLoader /> : children}
    </div>
  );
};

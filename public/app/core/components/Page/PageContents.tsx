// Libraries
import { cx } from '@emotion/css';
import React from 'react';

// Components
import PageLoader from '../PageLoader/PageLoader';

interface Props {
  isLoading?: boolean;
  children: React.ReactNode;
  className?: string;
}

export const PageContents = ({ isLoading, children, className }: Props) => {
  return <div className={cx('page-container', 'page-body', className)}>{isLoading ? <PageLoader /> : children}</div>;
};

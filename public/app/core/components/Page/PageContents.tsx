// Libraries
import React from 'react';

import PageLoader from '../PageLoader/PageLoader';

interface Props {
  isLoading?: boolean;
  children: React.ReactNode;
  className?: string;
}

export const PageContents = ({ isLoading, children, className }: Props) => {
  let content = className ? <div className={className}>{children}</div> : children;

  return <>{isLoading ? <PageLoader /> : content}</>;
};

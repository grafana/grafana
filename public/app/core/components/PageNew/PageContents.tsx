// Libraries
import React, { FC } from 'react';

import PageLoader from '../PageLoader/PageLoader';

interface Props {
  isLoading?: boolean;
  children: React.ReactNode;
  className?: string;
}

export const PageContents: FC<Props> = ({ isLoading, children, className }) => {
  let content = className ? <div className={className}>{children}</div> : children;

  return <>{isLoading ? <PageLoader /> : content}</>;
};

// Libraries
import React, { FC } from 'react';

import PageLoader from '../PageLoader/PageLoader';

interface Props {
  isLoading?: boolean;
  children: React.ReactNode;
  className?: string;
}

export const PageContents: FC<Props> = ({ isLoading, children }) => {
  return <>{isLoading ? <PageLoader /> : children}</>;
};

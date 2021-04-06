// Libraries
import React, { FC } from 'react';

// Components
import PageLoader from '../PageLoader/PageLoader';

interface Props {
  isLoading?: boolean;
  children: React.ReactNode;
}

export const PageContents: FC<Props> = ({ isLoading, children }) => {
  return <div className="page-container page-body">{isLoading ? <PageLoader /> : children}</div>;
};

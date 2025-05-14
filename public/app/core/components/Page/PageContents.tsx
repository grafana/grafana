// Libraries
import * as React from 'react';

import PageLoader from '../PageLoader/PageLoader';

interface Props {
  isLoading?: boolean;
  children: React.ReactNode;
  className?: string;

  // @PERCONA
  dataTestId?: string;
}

export const PageContents = ({ isLoading, children, className, dataTestId }: Props) => {
  let content =
    className || dataTestId ? (
      <div className={className} data-testid={dataTestId}>
        {children}
      </div>
    ) : (
      children
    );

  return <>{isLoading ? <PageLoader /> : content}</>;
};

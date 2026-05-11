// Libraries
import * as React from 'react';

import { PageLoader } from '@grafana/ui';
import { Branding } from 'app/core/components/Branding/Branding';

interface Props {
  isLoading?: boolean;
  children: React.ReactNode;
  className?: string;
}

export const PageContents = ({ isLoading, children, className }: Props) => {
  let content = className ? <div className={className}>{children}</div> : children;

  return (
    <>
      {isLoading ? (
        <PageLoader>
          <Branding.LoginLogo />
        </PageLoader>
      ) : (
        content
      )}
    </>
  );
};

import React from 'react';
import { LoadingPlaceholder } from '@grafana/ui';
import { Page } from './Page';

export const Loader = () => {
  return (
    <Page>
      <div className="page-loader-wrapper">
        <LoadingPlaceholder text="Loading..." />
      </div>
    </Page>
  );
};

import React from 'react';

import { LoadingPlaceholder } from '@grafana/ui';

interface Props {
  pageName?: string;
}

const PageLoader = ({ pageName = '' }: Props) => {
  const loadingText = `Loading ${pageName}...`;
  return (
    <div className="page-loader-wrapper">
      <LoadingPlaceholder text={loadingText} />
    </div>
  );
};

export default PageLoader;

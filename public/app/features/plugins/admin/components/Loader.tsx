import React from 'react';

import { LoadingPlaceholder } from '@grafana/ui';

export interface Props {
  text?: string;
}

export const Loader = ({ text = 'Loading...' }: Props) => {
  return (
    <div className="page-loader-wrapper">
      <LoadingPlaceholder text={text} />
    </div>
  );
};

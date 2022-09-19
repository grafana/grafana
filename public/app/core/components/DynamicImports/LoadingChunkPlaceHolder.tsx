import React from 'react';

import { LoadingPlaceholder } from '@grafana/ui';

export const LoadingChunkPlaceHolder = React.memo(() => (
  <div className="preloader">
    <LoadingPlaceholder text={'Loading...'} />
  </div>
));

LoadingChunkPlaceHolder.displayName = 'LoadingChunkPlaceHolder';

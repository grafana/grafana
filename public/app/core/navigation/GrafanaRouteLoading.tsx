import React from 'react';

import { LoadingPlaceholder } from '@grafana/ui';

export function GrafanaRouteLoading() {
  return (
    <div className="preloader">
      <LoadingPlaceholder text={'Loading...'} />
    </div>
  );
}

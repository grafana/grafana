import React from 'react';

import { EmbeddedDashboardProps } from '@grafana/runtime';

export function EmbeddedDashboardLazy(props: EmbeddedDashboardProps) {
  return <Component {...props} />;
}

const Component = React.lazy(async () => {
  const { EmbeddedDashboard } = await import(/* webpackChunkName: "EmbeddedDashboard" */ './EmbeddedDashboard');
  return { default: EmbeddedDashboard };
});

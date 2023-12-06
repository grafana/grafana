import React from 'react';

import { Page } from 'app/core/components/Page/Page';

import { EmbeddedDashboard } from './EmbeddedDashboard';

export function EmbeddedDashboardTestPage() {
  return (
    <Page
      navId="dashboards/browse"
      pageNav={{ text: 'Embedding dashboard', subTitle: 'Showing dashboard: Panel Tests - Pie chart' }}
    >
      <EmbeddedDashboard uid="lVE-2YFMz" />
    </Page>
  );
}

export default EmbeddedDashboardTestPage;

import React, { useState } from 'react';

import { PageLayoutType } from '@grafana/data';
import { Box, Drawer } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

import { EmbeddedDashboard } from './EmbeddedDashboard';

export function EmbeddedDashboardTestPage() {
  const [state, setState] = useState('?from=now-5m&to=now');

  return (
    <Page
      navId="dashboards/browse"
      pageNav={{ text: 'Embedding dashboard', subTitle: 'Showing dashboard: Panel Tests - Pie chart' }}
      layout={PageLayoutType.Canvas}
    >
      <Drawer title="test" onClose={() => {}}>
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <Box paddingY={2}>Internal url state: {state}</Box>
          <EmbeddedDashboard uid="O6GmNPvWk" initialState={state} onStateChange={setState} />
        </div>
      </Drawer>
    </Page>
  );
}

export default EmbeddedDashboardTestPage;

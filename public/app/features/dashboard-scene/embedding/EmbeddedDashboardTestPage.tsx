import { useState } from 'react';

import { PageLayoutType } from '@grafana/data';
import { Box } from '@grafana/ui';
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
      {/* this is a test page, no need to translate */}
      {/* eslint-disable-next-line @grafana/no-untranslated-strings */}
      <Box paddingY={2}>Internal url state: {state}</Box>
      <EmbeddedDashboard uid="lVE-2YFMz" initialState={state} onStateChange={setState} />
    </Page>
  );
}

export default EmbeddedDashboardTestPage;

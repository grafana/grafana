import { useState } from 'react';

import { PageLayoutType } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Box } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

import { EmbeddedDashboard } from './EmbeddedDashboard';

export function EmbeddedDashboardTestPage() {
  const [state, setState] = useState('?from=now-5m&to=now');

  return (
    <Page
      navId="dashboards/browse"
      pageNav={{
        text: t('dashboard-scene.embedded-dashboard-test-page.text.embedding-dashboard', 'Embedding dashboard'),
        subTitle: t(
          'dashboard-scene.embedded-dashboard-test-page.subTitle.showing-dashboard-panel-tests-pie-chart',
          'Showing dashboard: Panel Tests - Pie chart'
        ),
      }}
      layout={PageLayoutType.Canvas}
    >
      {/* this is a test page, no need to translate */}
      {/* eslint-disable-next-line @grafana/i18n/no-untranslated-strings */}
      <Box paddingY={2}>Internal url state: {state}</Box>
      <EmbeddedDashboard uid="lVE-2YFMz" initialState={state} onStateChange={setState} />
    </Page>
  );
}

export default EmbeddedDashboardTestPage;

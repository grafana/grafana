import React from 'react';

import { Page } from 'app/core/components/Page/Page';

export default function FeatureTogglePage() {
  return (
    <Page navId="correlations">
      <Page.Contents>
        <h1>Correlations are disabled</h1>
        To enable Correlations, add it in the Grafana config:
        <div>
          <pre>
            {`[feature_toggles]
correlations = true
`}
          </pre>
        </div>
      </Page.Contents>
    </Page>
  );
}

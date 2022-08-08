import React from 'react';

import { Page } from 'app/core/components/Page/Page';
import { useNavModel } from 'app/core/hooks/useNavModel';

export default function FeatureTogglePage() {
  const navModel = useNavModel('live-status');

  return (
    <Page navModel={navModel}>
      <Page.Contents>
        <h1>Pipeline is not enabled</h1>
        To enable pipelines, enable the feature toggle:
        <pre>
          {`[feature_toggles] 
enable = live-pipeline
`}
        </pre>
      </Page.Contents>
    </Page>
  );
}

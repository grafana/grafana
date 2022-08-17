import React from 'react';

import { Page } from 'app/core/components/Page/Page';
import { useNavModel } from 'app/core/hooks/useNavModel';

export default function FeatureTogglePage() {
  const navModel = useNavModel('alert-list');

  return (
    <Page navModel={navModel}>
      <Page.Contents>
        <h1>Alerting is not enabled</h1>
        To enable alerting, enable it in the Grafana config:
        <div>
          <pre>
            {`[unified_alerting]
enable = true
`}
          </pre>
        </div>
        <div>
          For legacy alerting
          <pre>
            {`[alerting]
enable = true
`}
          </pre>
        </div>
      </Page.Contents>
    </Page>
  );
}

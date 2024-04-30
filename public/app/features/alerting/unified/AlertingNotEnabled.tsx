import React from 'react';

import { NavModel } from '@grafana/data';
import { Page } from 'app/core/components/Page/Page';

export default function FeatureTogglePage() {
  const navModel: NavModel = {
    node: {
      text: 'Alerting is not enabled',
      hideFromBreadcrumbs: true,
      subTitle: 'To enable alerting, enable it in the Grafana config',
    },
    main: {
      text: 'Alerting is not enabled',
    },
  };

  return (
    <Page navModel={navModel}>
      <Page.Contents>
        <pre>
          {`[unified_alerting]
enabled = true
`}
        </pre>
      </Page.Contents>
    </Page>
  );
}

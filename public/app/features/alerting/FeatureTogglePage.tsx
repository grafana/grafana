import React from 'react';
import Page from 'app/core/components/Page/Page';
import { useNavModel } from 'app/core/hooks/useNavModel';

export default function FeatureTogglePage() {
  const navModel = useNavModel('alerting');

  return (
    <Page navModel={navModel}>
      <Page.Contents>
        <h1>Alerting is not enabled</h1>
        To enable alerting, enable it in the server config:
        <pre>
          {`[alerting]
enable = true
`}
        </pre>
      </Page.Contents>
    </Page>
  );
}

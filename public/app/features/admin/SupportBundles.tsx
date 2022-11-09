import React from 'react';

import { Button } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

function SupportBundles() {
  return (
    <Page navId="support-bundles">
      <Page.Contents>
        <div className="grafana-info-box span8" style={{ margin: '20px 0 25px 0' }}>
          Support bundles allow you to easily collect and share Grafana logs, configuration, and data with the Grafana
          Labs team.
        </div>

        <Button variant="primary">Download Support Bundle</Button>
      </Page.Contents>
    </Page>
  );
}

export default SupportBundles;

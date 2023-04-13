import React from 'react';

import { Alert } from '@grafana/ui';

export const LOCAL_STORAGE_KEY = 'grafana.legacyalerting.unifiedalertingpromo';

const DeprecationNotice = () => (
  <Alert severity="warning" title="Grafana legacy alerting is deprecated and will be removed in a future release.">
    <p>
      You are using Grafana legacy alerting, which has been deprecated since Grafana 9.0. It will be removed in a future
      release without further notice.
      <br />
      We recommend upgrading to Grafana Alerting as soon as possible.
    </p>
    <p>
      See{' '}
      <a href="https://grafana.com/docs/grafana/latest/alerting/migrating-alerts/">
        how to upgrade to Grafana Alerting
      </a>{' '}
      to learn more.
    </p>
  </Alert>
);

export { DeprecationNotice };

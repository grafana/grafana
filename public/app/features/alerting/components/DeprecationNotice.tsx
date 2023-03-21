import React from 'react';

import { Alert } from '@grafana/ui';

export const LOCAL_STORAGE_KEY = 'grafana.legacyalerting.unifiedalertingpromo';

const DeprecationNotice = () => (
  <Alert severity="warning" title="Grafana legacy alerting is going away soon">
    <p>
      You are using Grafana legacy alerting, it has been deprecated and will be removed in the next major version of
      Grafana.
      <br />
      We encourage you to upgrade to the new Grafana Alerting experience.
    </p>
    <p>
      See{' '}
      <a href="https://grafana.com/docs/grafana/latest/alerting/unified-alerting/difference-old-new/">
        What’s New with Grafana Alerting
      </a>{' '}
      to learn more about what&lsquo;s new or learn{' '}
      <a href="https://grafana.com/docs/grafana/latest/alerting/unified-alerting/opt-in/">
        how to enable the new Grafana Alerting feature
      </a>
      .
    </p>
  </Alert>
);

export { DeprecationNotice };

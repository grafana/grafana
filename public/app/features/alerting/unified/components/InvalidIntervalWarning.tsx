import React from 'react';

import { config } from '@grafana/runtime';
import { Alert } from '@grafana/ui';

const EvaluationIntervalLimitExceeded = () => (
  <Alert severity="warning" title="Global evalutation interval limit exceeded">
    A minimum evaluation interval of <strong>{config.unifiedAlerting.minInterval}</strong> has been configured in
    Grafana.
    <br />
    Please contact the administrator to configure a lower interval.
  </Alert>
);

export { EvaluationIntervalLimitExceeded };

import { config } from '@grafana/runtime';
import { Alert } from '@grafana/ui';
import { t } from 'app/core/internationalization';

const EvaluationIntervalLimitExceeded = () => (
  <Alert
    severity="warning"
    title={t(
      'alerting.evaluation-interval-limit-exceeded.title-global-evaluation-interval-limit-exceeded',
      'Global evaluation interval limit exceeded'
    )}
  >
    A minimum evaluation interval of <strong>{config.unifiedAlerting.minInterval}</strong> has been configured in
    Grafana.
    <br />
    Please contact the administrator to configure a lower interval.
  </Alert>
);

export { EvaluationIntervalLimitExceeded };

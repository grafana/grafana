import { config } from '@grafana/runtime';
import { Alert } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';

const EvaluationIntervalLimitExceeded = () => (
  <Alert
    severity="warning"
    title={t(
      'alerting.evaluation-interval-limit-exceeded.title-global-evaluation-interval-limit-exceeded',
      'Global evaluation interval limit exceeded'
    )}
  >
    <Trans
      i18nKey="alerting.evaluation-interval-limit-exceeded.body-minimum-interval"
      values={{ minInterval: config.unifiedAlerting.minInterval }}
    >
      A minimum evaluation interval of <strong>{'{{minInterval}}'}</strong> has been configured in Grafana.
      <br />
      Please contact the administrator to configure a lower interval.
    </Trans>
  </Alert>
);

export { EvaluationIntervalLimitExceeded };

import { Alert } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';

const InfoPausedRule = () => {
  return (
    <Alert severity="info" title={t('alerting.alert.evaluation-paused', 'Alert evaluation currently paused')}>
      <Trans i18nKey="alerting.alert.evaluation-paused-description">
        Notifications for this rule will not fire and no alert instances will be created until the rule is un-paused.
      </Trans>
    </Alert>
  );
};

export default InfoPausedRule;

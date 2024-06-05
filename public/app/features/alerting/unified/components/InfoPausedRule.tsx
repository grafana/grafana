import { Alert } from '@grafana/ui';

const InfoPausedRule = () => {
  return (
    <Alert severity="info" title="Alert evaluation currently paused">
      Notifications for this rule will not fire and no alert instances will be created until the rule is un-paused.
    </Alert>
  );
};

export default InfoPausedRule;

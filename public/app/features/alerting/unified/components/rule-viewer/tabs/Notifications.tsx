import { type RulerGrafanaRuleDTO } from 'app/types/unified-alerting-dto';

import { NotificationsScene } from '../../../notifications/NotificationsScene';

interface NotificationsProps {
  rule: RulerGrafanaRuleDTO;
}

const Notifications = ({ rule }: NotificationsProps) => {
  const ruleUID = rule.grafana_alert.uid;

  return (
    <NotificationsScene
      ruleUID={ruleUID}
      hideGraph
      defaultTimeRange={{
        from: 'now-30d',
        to: 'now',
      }}
    />
  );
};

export { Notifications };

import React, { FC } from 'react';

import { useTheme2 } from '@grafana/ui';

import { RuleEditorSection } from './RuleEditorSection';

export const NotificationsStep: FC = () => {
  const theme = useTheme2();

  return (
    <RuleEditorSection
      stepNo={4}
      title="Notifications"
      description="Grafana handles the notifications for alerts by assigning labels to alerts. These labels connect alerts to contact points and silence alert instances that have matching labels."
    >
      <img
        src={`/public/img/alerting/notification_policy_${theme.name.toLowerCase()}.svg`}
        alt="notification policy flow chart"
      />
    </RuleEditorSection>
  );
};

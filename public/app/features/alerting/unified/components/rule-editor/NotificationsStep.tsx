import { css } from '@emotion/css';
import React, { FC, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Card, Link, useStyles2, useTheme2 } from '@grafana/ui';

import { RuleEditorSection } from './RuleEditorSection';

export const NotificationsStep: FC = () => {
  const [hideFlowChart, setHideFlowChart] = useState(false);
  const styles = useStyles2(getStyles);
  const theme = useTheme2();

  return (
    <RuleEditorSection
      stepNo={4}
      title="Notifications"
      description="Grafana handles the notifications for alerts by assigning labels to alerts. These labels connect alerts to contact points and silence alert instances that have matching labels."
    >
      <div>
        <div className={styles.hideButton} onClick={() => setHideFlowChart(!hideFlowChart)}>
          {`${!hideFlowChart ? 'Hide' : 'Show'} flow chart`}
        </div>
      </div>
      <div className={styles.contentWrapper}>
        {!hideFlowChart && (
          <img
            src={`/public/img/alerting/notification_policy_${theme.name.toLowerCase()}.svg`}
            alt="notification policy flow chart"
          />
        )}
        <Card className={styles.card}>
          <Card.Heading>Root route – default for all alerts</Card.Heading>
          <Card.Description>
            Without custom labels, your alert will be routed through the root route. To view and edit the root route, go
            to <Link href="/alerting/routes">notification policies</Link> or contact your admin in case you are using
            non-Grafana alert management.
          </Card.Description>
        </Card>
      </div>
    </RuleEditorSection>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  contentWrapper: css`
    display: flex;
    align-items: center;
  `,
  hideButton: css`
    color: ${theme.colors.text.secondary};
    cursor: pointer;
    margin-bottom: ${theme.spacing(1)};
  `,
  card: css`
    max-width: 500px;
    margin-left: ${theme.spacing(3)};
  `,
});

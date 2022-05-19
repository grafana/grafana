import { css } from '@emotion/css';
import React, { FC, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, useTheme2 } from '@grafana/ui';

import { AmRootRoute } from '../amroutes/AmRootRoute';

import { RuleEditorSection } from './RuleEditorSection';

export const NotificationsStep: FC = () => {
  const [hideFlowChart, setHideFlowChart] = useState(false);
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const noLabels = true;

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
        <div>
          {noLabels && (
            <div>
              <span>
                You currently haven’t added any labels. Therefore, this alert will use the default notification policy,
                “Root policy”.
              </span>
            </div>
          )}
        </div>
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
});

import { AlertmanagerGroup } from 'app/plugins/datasource/alertmanager/types';
import React, { useState } from 'react';
import { GrafanaTheme2, intervalToAbbreviatedDurationString } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { css } from '@emotion/css';

import { AlertLabels } from 'app/features/alerting/unified/components/AlertLabels';
import { AmNotificationsGroupHeader } from 'app/features/alerting/unified/components/amnotifications/AmNotificationsGroupHeader';
import { CollapseToggle } from 'app/features/alerting/unified/components/CollapseToggle';
import { getNotificationsTextColors } from 'app/features/alerting/unified/styles/notifications';

type Props = {
  group: AlertmanagerGroup;
};

export const AmNotificationsGroup = ({ group }: Props) => {
  const [showAlerts, setShowAlerts] = useState(false);
  const styles = useStyles2(getStyles);
  const textStyles = useStyles2(getNotificationsTextColors);

  return (
    <div className={styles.group}>
      {Object.keys(group.labels).length > 0 ? (
        <AlertLabels labels={group.labels} />
      ) : (
        <div className={styles.noGroupingText}>No grouping</div>
      )}
      <div className={styles.row}>
        <CollapseToggle isCollapsed={!showAlerts} onToggle={() => setShowAlerts(!showAlerts)} />{' '}
        <AmNotificationsGroupHeader group={group} />
      </div>
      {showAlerts && (
        <div className={styles.alerts}>
          {group.alerts.map((alert, index) => {
            const state = alert.status.state.toUpperCase();
            const interval = intervalToAbbreviatedDurationString({
              start: new Date(alert.startsAt),
              end: Date.now(),
            });

            return (
              <div className={styles.alert} key={`${alert.fingerprint}-${index}`}>
                <div>
                  <span className={textStyles[alert.status.state]}>{state} </span>for {interval}
                </div>
                <div>
                  <AlertLabels labels={alert.labels} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  noGroupingText: css`
    height: ${theme.spacing(4)};
  `,
  group: css`
    background-color: ${theme.colors.background.secondary};
    margin: ${theme.spacing(0.5, 1, 0.5, 1)};
    padding: ${theme.spacing(1)};
  `,
  row: css`
    display: flex;
    flex-direction: row;
    align-items: center;
  `,
  alerts: css`
    margin: ${theme.spacing(0, 2, 0, 4)};
  `,
  alert: css`
    padding: ${theme.spacing(1, 0)};
    & + & {
      border-top: 1px solid ${theme.colors.border.medium};
    }
  `,
});

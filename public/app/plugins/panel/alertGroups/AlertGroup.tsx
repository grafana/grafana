import { css } from '@emotion/css';
import React, { useState, useEffect } from 'react';

import { GrafanaTheme2, intervalToAbbreviatedDurationString } from '@grafana/data';
import { useStyles2, LinkButton } from '@grafana/ui';
import { AlertLabels } from 'app/features/alerting/unified/components/AlertLabels';
import { CollapseToggle } from 'app/features/alerting/unified/components/CollapseToggle';
import { AlertGroupHeader } from 'app/features/alerting/unified/components/alert-groups/AlertGroupHeader';
import { getNotificationsTextColors } from 'app/features/alerting/unified/styles/notifications';
import { makeAMLink, makeLabelBasedSilenceLink } from 'app/features/alerting/unified/utils/misc';
import { AlertmanagerGroup, AlertState } from 'app/plugins/datasource/alertmanager/types';

type Props = {
  alertManagerSourceName: string;
  group: AlertmanagerGroup;
  expandAll: boolean;
};

export const AlertGroup = ({ alertManagerSourceName, group, expandAll }: Props) => {
  const [showAlerts, setShowAlerts] = useState(expandAll);
  const styles = useStyles2(getStyles);
  const textStyles = useStyles2(getNotificationsTextColors);

  useEffect(() => setShowAlerts(expandAll), [expandAll]);

  return (
    <div className={styles.group} data-testid="alert-group">
      {Object.keys(group.labels).length > 0 ? (
        <AlertLabels labels={group.labels} />
      ) : (
        <div className={styles.noGroupingText}>No grouping</div>
      )}
      <div className={styles.row}>
        <CollapseToggle isCollapsed={!showAlerts} onToggle={() => setShowAlerts(!showAlerts)} />{' '}
        <AlertGroupHeader group={group} />
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
              <div data-testid={'alert-group-alert'} className={styles.alert} key={`${alert.fingerprint}-${index}`}>
                <div>
                  <span className={textStyles[alert.status.state]}>{state} </span>for {interval}
                </div>
                <div>
                  <AlertLabels labels={alert.labels} />
                </div>
                <div className={styles.actionsRow}>
                  {alert.status.state === AlertState.Suppressed && (
                    <LinkButton
                      href={`${makeAMLink(
                        '/alerting/silences',
                        alertManagerSourceName
                      )}&silenceIds=${alert.status.silencedBy.join(',')}`}
                      className={styles.button}
                      icon={'bell'}
                      size={'sm'}
                    >
                      Manage silences
                    </LinkButton>
                  )}
                  {alert.status.state === AlertState.Active && (
                    <LinkButton
                      href={makeLabelBasedSilenceLink(alertManagerSourceName, alert.labels)}
                      className={styles.button}
                      icon={'bell-slash'}
                      size={'sm'}
                    >
                      Silence
                    </LinkButton>
                  )}
                  {alert.generatorURL && (
                    <LinkButton className={styles.button} href={alert.generatorURL} icon={'chart-line'} size={'sm'}>
                      See source
                    </LinkButton>
                  )}
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
    gap: ${theme.spacing(1)};
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
  button: css`
    & + & {
      margin-left: ${theme.spacing(1)};
    }
  `,
  actionsRow: css`
    padding: ${theme.spacing(1, 0)};
  `,
});

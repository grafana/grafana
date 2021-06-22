import { AlertmanagerAlert, AlertState } from 'app/plugins/datasource/alertmanager/types';

import React, { useState } from 'react';
import { GrafanaTheme2, intervalToAbbreviatedDurationString, Labels } from '@grafana/data';
import { AmAlertStateTag } from '../silences/AmAlertStateTag';
import { AlertLabels } from '../AlertLabels';
import { CollapseToggle } from '../CollapseToggle';
import { LinkButton, useStyles2 } from '@grafana/ui';
import { css } from '@emotion/css';
import { makeAMLink } from '../../utils/misc';

interface Props {
  className?: string;
  alert: AlertmanagerAlert;
  alertManagerSourceName: string;
}

export const AmNotificationsAlertsTableRow = ({ alert, alertManagerSourceName, className }: Props) => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(true);
  const styles = useStyles2(getStyles);

  const getMatcherQueryParams = (labels: Labels) => {
    return `matchers=${encodeURIComponent(
      Object.entries(labels)
        .filter(([labelKey]) => !(labelKey.startsWith('__') && labelKey.endsWith('__')))
        .map(([labelKey, labelValue]) => {
          return `${labelKey}=${labelValue}`;
        })
        .join(',')
    )}`;
  };

  return (
    <>
      <tr className={className}>
        <td>
          <CollapseToggle isCollapsed={isCollapsed} onToggle={(bool) => setIsCollapsed(bool)} />
        </td>
        <td>
          <AmAlertStateTag state={alert.status.state} />
          <span className={styles.duration}>
            for{' '}
            {intervalToAbbreviatedDurationString({
              start: new Date(alert.startsAt),
              end: new Date(alert.endsAt),
            })}
          </span>
        </td>
        <td>
          <AlertLabels labels={alert.labels} />
        </td>
        <td />
      </tr>
      {!isCollapsed && (
        <>
          <tr className={className}>
            <td />
            <td className={styles.actionsRow} colSpan={2}>
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
                  href={`${makeAMLink('/alerting/silence/new', alertManagerSourceName)}&${getMatcherQueryParams(
                    alert.labels
                  )}`}
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
            </td>
            <td />
          </tr>
          {Object.entries(alert.annotations).map(([annotationKey, annotationValue]) => {
            return (
              <tr key={`${alert.fingerprint}-${annotationKey}`} className={className}>
                <td />
                <td className={styles.annotationKey}>{annotationKey}</td>
                <td className={styles.annotationValue}>{annotationValue}</td>
                <td />
              </tr>
            );
          })}
          <tr className={className}>
            <td />
            <td>Receivers:</td>
            <td>
              {alert.receivers.reduce((val, { name }) => {
                if (val === '') {
                  return name;
                } else {
                  return val.concat(`, ${name}`);
                }
              }, '')}
            </td>
            <td />
          </tr>
        </>
      )}
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  button: css`
    & + & {
      margin-left: ${theme.spacing(1)};
    }
  `,
  duration: css`
    margin-left: ${theme.spacing(1)};
  `,
  actionsRow: css`
    padding: ${theme.spacing(2, 1)} !important;
    border-bottom: 1px solid ${theme.colors.border.medium};
  `,
  annotationKey: css`
    color: ${theme.colors.text.primary};
  `,
  annotationValue: css`
    color: ${theme.colors.text.secondary};
  `,
});

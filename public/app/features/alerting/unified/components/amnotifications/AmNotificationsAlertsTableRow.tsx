import { AlertmanagerAlert, AlertState } from 'app/plugins/datasource/alertmanager/types';

import React, { useState } from 'react';
import { GrafanaTheme2, intervalToAbbreviatedDurationString } from '@grafana/data';
import { AmAlertStateTag } from '../silences/AmAlertStateTag';
import { AlertLabels } from '../AlertLabels';
import { CollapseToggle } from '../CollapseToggle';
import { Button, LinkButton, useStyles2 } from '@grafana/ui';
import { css } from '@emotion/css';

interface Props {
  className?: string;
  alert: AlertmanagerAlert;
}

export const AmNotificationsAlertsTableRow = ({ alert, className }: Props) => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(true);
  const styles = useStyles2(getStyles);

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
      </tr>
      {!isCollapsed && (
        <>
          <tr className={className}>
            <td />
            <td colSpan={2}>
              {alert.status.state === AlertState.Suppressed && (
                <Button className={styles.button} icon={'bell'} size={'sm'}>
                  Unsilence
                </Button>
              )}
              {alert.generatorURL && (
                <LinkButton className={styles.button} href={alert.generatorURL} icon={'chart-line'} size={'sm'}>
                  See graph
                </LinkButton>
              )}
            </td>
          </tr>
          {Object.entries(alert.annotations).map(([annotationKey, annotationValue]) => {
            <tr key={annotationKey} className={className}>
              <td />
              <td>{annotationKey}</td>
              <td>{annotationValue}</td>
            </tr>;
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
});

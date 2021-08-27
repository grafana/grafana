import React from 'react';
import { GrafanaTheme2 } from '@grafana/data';
import { css } from '@emotion/css';
import { Button, Icon, useStyles2 } from '@grafana/ui';

const alertmanagers = [
  { alertmanager: 'test1', url: 'some/url' },
  { alertmanager: 'test2', url: 'some/other/url' },
];

export const ExternalAlertmanagers = () => {
  const styles = useStyles2(getStyles);

  return (
    <div>
      <h4>External Alertmanagers</h4>
      <div className={styles.muted}>
        If you are running Grafana in HA mode, you can point Prometheus to a list of Alertmanagers. Use the source URL
        input below to discover alertmanagers.
      </div>
      <div className={styles.actions}>
        <Button type="button">Add Alertmanager</Button>
      </div>
      <table className="filter-table form-inline filter-table--hover">
        <thead>
          <tr>
            <th>Name</th>
            <th>Url</th>
            <th style={{ width: '2%' }} />
          </tr>
        </thead>
        <tbody>
          {alertmanagers.map((am, index) => {
            return (
              <tr key={index}>
                <td>{am.alertmanager}</td>
                <td className="link-td">{am.url}</td>
                <td>
                  <Icon name="pen" />
                  <Icon name="trash-alt" />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  muted: css`
    color: ${theme.colors.text.secondary};
  `,
  actions: css`
    margin-top: ${theme.spacing(2)};
    display: flex;
    justify-content: flex-end;
  `,
  table: css``,
});

import React, { useState } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { Button, HorizontalGroup, Icon, useStyles2 } from '@grafana/ui';
import { AddAlertManagerModal } from './AddAlertManagerModal';

const alertmanagers = [
  { alertmanager: 'test1', url: 'some/url' },
  { alertmanager: 'test2', url: 'some/other/url' },
];

export const ExternalAlertmanagers = () => {
  const styles = useStyles2(getStyles);
  const [modalOpen, setModalState] = useState<boolean>(false);

  return (
    <div>
      <h4>External Alertmanagers</h4>
      <div className={styles.muted}>
        If you are running Grafana in HA mode, you can point Prometheus to a list of Alertmanagers. Use the source URL
        input below to discover alertmanagers.
      </div>
      <div className={styles.actions}>
        <Button type="button" onClick={() => setModalState(true)}>
          Add Alertmanager
        </Button>
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
                  <HorizontalGroup>
                    <Icon name="pen" />
                    <Icon name="trash-alt" />
                  </HorizontalGroup>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {modalOpen && <AddAlertManagerModal onClose={() => setModalState(false)} />}
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

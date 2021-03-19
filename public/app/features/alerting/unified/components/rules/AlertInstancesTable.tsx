import { GrafanaTheme } from '@grafana/data';
import { Button, useStyles } from '@grafana/ui';
import { AlertingRule } from 'app/types/unified-alerting/internal';
import { css, cx } from 'emotion';
import React, { FC } from 'react';
import { getAlertTableStyles } from '../../styles/table';
import { AlertLabels } from '../AlertLabels';
import { StateTag } from '../StateTag';

interface Props {
  instances: AlertingRule['alerts'];
}

export const AlertInstancesTable: FC<Props> = ({ instances }) => {
  const styles = useStyles(getStyles);
  const tableStyles = useStyles(getAlertTableStyles);
  return (
    <table className={cx(tableStyles.table, styles.table)}>
      <thead>
        <tr>
          <th>State</th>
          <th>Labels</th>
          <th>Created</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {instances.map((instance, idx) => (
          <tr key={idx} className={idx % 2 === 0 ? tableStyles.evenRow : undefined}>
            <td>
              <StateTag status={instance.state} />
            </td>
            <td className={styles.labelsCell}>
              <AlertLabels labels={instance.labels} />
            </td>
            <td>{String(instance.activeAt).substr(0, 19).replace('T', ' ')}</td>
            <td>
              <Button className={styles.buttonSilence} variant="secondary" icon="bell" size="xs">
                Silence
              </Button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export const getStyles = (theme: GrafanaTheme) => ({
  labelsCell: css`
    padding-top: ${theme.spacing.xs} !important;
  `,
  table: css`
    td {
      vertical-align: top;
      padding-top: ${theme.spacing.sm};
    }
  `,
  buttonSilence: css`
    height: 24px;
    font-size: ${theme.typography.size.sm};
  `,
});

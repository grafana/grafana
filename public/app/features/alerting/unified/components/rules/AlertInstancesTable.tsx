import { GrafanaTheme } from '@grafana/data';
import { useStyles } from '@grafana/ui';
import { AlertingRule } from 'app/types/unified-alerting';
import { css, cx } from '@emotion/css';
import React, { FC, Fragment, useState } from 'react';
import { getAlertTableStyles } from '../../styles/table';
import { alertInstanceKey } from '../../utils/rules';
import { AlertLabels } from '../AlertLabels';
import { CollapseToggle } from '../CollapseToggle';
import { StateTag } from '../StateTag';
import { AlertInstanceDetails } from './AlertInstanceDetails';

interface Props {
  instances: AlertingRule['alerts'];
}

export const AlertInstancesTable: FC<Props> = ({ instances }) => {
  const styles = useStyles(getStyles);
  const tableStyles = useStyles(getAlertTableStyles);

  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);

  const toggleExpandedState = (ruleKey: string) =>
    setExpandedKeys(
      expandedKeys.includes(ruleKey) ? expandedKeys.filter((key) => key !== ruleKey) : [...expandedKeys, ruleKey]
    );

  return (
    <table className={cx(tableStyles.table, styles.table)}>
      <colgroup>
        <col className={styles.colExpand} />
        <col className={styles.colState} />
        <col />
        <col />
      </colgroup>
      <thead>
        <tr>
          <th></th>
          <th>State</th>
          <th>Labels</th>
          <th>Created</th>
        </tr>
      </thead>
      <tbody>
        {instances.map((instance, idx) => {
          const key = alertInstanceKey(instance);
          const isExpanded = expandedKeys.includes(key);
          return (
            <Fragment key={key}>
              <tr className={idx % 2 === 0 ? tableStyles.evenRow : undefined}>
                <td>
                  <CollapseToggle
                    isCollapsed={!isExpanded}
                    onToggle={() => toggleExpandedState(key)}
                    data-testid="alert-collapse-toggle"
                  />
                </td>
                <td>
                  <StateTag status={instance.state} />
                </td>
                <td className={styles.labelsCell}>
                  <AlertLabels labels={instance.labels} />
                </td>
                <td className={styles.createdCell}>{instance.activeAt.substr(0, 19).replace('T', ' ')}</td>
              </tr>
              {isExpanded && (
                <tr className={idx % 2 === 0 ? tableStyles.evenRow : undefined}>
                  <td></td>
                  <td colSpan={3}>
                    <AlertInstanceDetails instance={instance} />
                  </td>
                </tr>
              )}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
};

export const getStyles = (theme: GrafanaTheme) => ({
  colExpand: css`
    width: 36px;
  `,
  colState: css`
    width: 110px;
  `,
  labelsCell: css`
    padding-top: ${theme.spacing.xs} !important;
    padding-bottom: ${theme.spacing.xs} !important;
  `,
  createdCell: css`
    white-space: nowrap;
  `,
  table: css`
    td {
      vertical-align: top;
      padding-top: ${theme.spacing.sm};
      padding-bottom: ${theme.spacing.sm};
    }
  `,
});

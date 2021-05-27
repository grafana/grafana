import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { Alert } from 'app/types/unified-alerting';
import { css, cx } from '@emotion/css';
import React, { FC, Fragment, useMemo, useState } from 'react';
import { getAlertTableStyles } from '../../styles/table';
import { alertInstanceKey } from '../../utils/rules';
import { AlertLabels } from '../AlertLabels';
import { CollapseToggle } from '../CollapseToggle';
import { AlertInstanceDetails } from './AlertInstanceDetails';
import { AlertStateTag } from './AlertStateTag';

type AlertWithKey = Alert & { key: string };

interface Props {
  instances: Alert[];
}

export const AlertInstancesTable: FC<Props> = ({ instances }) => {
  const styles = useStyles2(getStyles);
  const tableStyles = useStyles2(getAlertTableStyles);

  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);

  // add key & sort instance. API returns instances in random order, different every time.
  const sortedInstances = useMemo(
    (): AlertWithKey[] =>
      instances
        .map((instance) => ({
          ...instance,
          key: alertInstanceKey(instance),
        }))
        .sort((a, b) => a.key.localeCompare(b.key)),
    [instances]
  );

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
        {sortedInstances.map(({ key, ...instance }, idx) => {
          const isExpanded = expandedKeys.includes(key);

          // don't allow expanding if there's nothing to show
          const isExpandable = instance.value || !!Object.keys(instance.annotations ?? {}).length;
          return (
            <Fragment key={key}>
              <tr className={idx % 2 === 0 ? tableStyles.evenRow : undefined}>
                <td>
                  {isExpandable && (
                    <CollapseToggle
                      isCollapsed={!isExpanded}
                      onToggle={() => toggleExpandedState(key)}
                      data-testid="alert-collapse-toggle"
                    />
                  )}
                </td>
                <td>
                  <AlertStateTag state={instance.state} />
                </td>
                <td className={styles.labelsCell}>
                  <AlertLabels labels={instance.labels} />
                </td>
                <td className={styles.createdCell}>
                  {instance.activeAt.startsWith('0001') ? '-' : instance.activeAt.substr(0, 19).replace('T', ' ')}
                </td>
              </tr>
              {isExpanded && isExpandable && (
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

export const getStyles = (theme: GrafanaTheme2) => ({
  colExpand: css`
    width: 36px;
  `,
  colState: css`
    width: 110px;
  `,
  labelsCell: css`
    padding-top: ${theme.spacing(0.5)} !important;
    padding-bottom: ${theme.spacing(0.5)} !important;
  `,
  createdCell: css`
    white-space: nowrap;
  `,
  table: css`
    td {
      vertical-align: top;
      padding-top: ${theme.spacing(1)};
      padding-bottom: ${theme.spacing(1)};
    }
  `,
});

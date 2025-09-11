import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { getLabelColor } from '../../components/AlertLabels';
import { Label } from '../../components/Label';
import { Domain, GenericGroupedRow, WorkbenchRow } from '../types';

import { GenericRow } from './GenericRow';
import { generateRowKey, isAlertRuleRow } from './utils';

interface GroupRowProps {
  row: GenericGroupedRow;
  leftColumnWidth: number;
  domain: Domain;
  rowKey: React.Key;
  depth?: number;
}

// Helper function to render a WorkbenchRow (avoiding circular dependency)
function renderWorkbenchRow(
  row: WorkbenchRow,
  leftColumnWidth: number,
  domain: Domain,
  key: React.Key,
  depth = 0
): React.ReactElement {
  if (isAlertRuleRow(row)) {
    // Lazy import to avoid circular dependency
    const { AlertRuleRow } = require('./AlertRuleRow');
    return (
      <AlertRuleRow key={key} row={row} leftColumnWidth={leftColumnWidth} domain={domain} rowKey={key} depth={depth} />
    );
  } else {
    return (
      <GroupRow key={key} row={row} leftColumnWidth={leftColumnWidth} domain={domain} rowKey={key} depth={depth} />
    );
  }
}

export const GroupRow = ({ row, leftColumnWidth, domain, rowKey, depth = 0 }: GroupRowProps) => {
  const styles = useStyles2(getStyles);

  return (
    <GenericRow
      key={rowKey}
      width={leftColumnWidth}
      title={
        <Label
          size="sm"
          label={row.metadata.label}
          value={row.metadata.value}
          color={getLabelColor(row.metadata.label)}
        />
      }
      isOpenByDefault={true}
      leftColumnClassName={styles.groupRow}
      rightColumnClassName={styles.groupRow}
      depth={depth}
    >
      {row.rows.map((childRow, childIndex) =>
        renderWorkbenchRow(
          childRow,
          leftColumnWidth,
          domain,
          `${rowKey}-${generateRowKey(childRow, childIndex)}`,
          depth + 1
        )
      )}
    </GenericRow>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  groupRow: css({
    backgroundColor: theme.colors.background.secondary,
  }),
});

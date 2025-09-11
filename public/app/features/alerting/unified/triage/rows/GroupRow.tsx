import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { Label } from '../../components/Label';
import { Domain, GenericGroupedRow, WorkbenchRow } from '../types';

import { GenericRow } from './GenericRow';
import { generateRowKey, isAlertRuleRow } from './utils';

interface GroupRowProps {
  row: GenericGroupedRow;
  leftColumnWidth: number;
  domain: Domain;
  rowKey: React.Key;
}

// Helper function to render a WorkbenchRow (avoiding circular dependency)
function renderWorkbenchRow(
  row: WorkbenchRow,
  leftColumnWidth: number,
  domain: Domain,
  key: React.Key
): React.ReactElement {
  if (isAlertRuleRow(row)) {
    // Lazy import to avoid circular dependency
    const { AlertRuleRow } = require('./AlertRuleRow');
    return <AlertRuleRow key={key} row={row} leftColumnWidth={leftColumnWidth} domain={domain} rowKey={key} />;
  } else {
    return <GroupRow key={key} row={row} leftColumnWidth={leftColumnWidth} domain={domain} rowKey={key} />;
  }
}

export const GroupRow = ({ row, leftColumnWidth, domain, rowKey }: GroupRowProps) => {
  const styles = useStyles2(getStyles);

  return (
    <GenericRow
      key={rowKey}
      width={leftColumnWidth}
      title={<Label size="md" label={row.metadata.label} value={row.metadata.value} />}
      content={null}
      isOpenByDefault={true}
      leftColumnClassName={styles.groupRow}
    >
      {row.rows.map((childRow, childIndex) =>
        renderWorkbenchRow(childRow, leftColumnWidth, domain, `${rowKey}-${generateRowKey(childRow, childIndex)}`)
      )}
    </GenericRow>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  groupRow: css({
    backgroundColor: theme.colors.background.secondary,
  }),
});

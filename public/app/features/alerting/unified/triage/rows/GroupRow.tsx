import React from 'react';

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
  return (
    <GenericRow
      key={rowKey}
      width={leftColumnWidth}
      title={row.metadata.value}
      actions={<Label size="sm" value={row.metadata.label} />}
      content={null}
      isOpenByDefault={true}
    >
      {row.rows.map((childRow, childIndex) =>
        renderWorkbenchRow(childRow, leftColumnWidth, domain, `${rowKey}-${generateRowKey(childRow, childIndex)}`)
      )}
    </GenericRow>
  );
};

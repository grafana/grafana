import { WorkbenchRow } from '../types';

// Generate unique keys for WorkbenchRow items
export function generateRowKey(row: WorkbenchRow, fallbackIndex: number): string {
  if (row.type === 'alertRule') {
    // Use ruleUID as primary key for AlertRuleRow
    return `alert-${row.metadata.ruleUID}`;
  } else {
    // For GenericGroupedRow, create key from label and value
    const groupedRow = row;
    return `group-${groupedRow.metadata.label}-${groupedRow.metadata.value}`;
  }
}

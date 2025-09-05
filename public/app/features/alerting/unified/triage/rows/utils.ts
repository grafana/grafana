import { WorkbenchRow } from '../types';

// Helper function to determine if a row is an AlertRuleRow
export function isAlertRuleRow(row: WorkbenchRow): row is import('../types').AlertRuleRow {
  return 'ruleUID' in row.metadata;
}

// Generate unique keys for WorkbenchRow items
export function generateRowKey(row: WorkbenchRow, fallbackIndex: number): string {
  if (isAlertRuleRow(row)) {
    // Use ruleUID as primary key for AlertRuleRow
    return `alert-${row.metadata.ruleUID}`;
  } else {
    // For GenericGroupedRow, create key from label and value
    const groupedRow = row;
    return `group-${groupedRow.metadata.label}-${groupedRow.metadata.value}`;
  }
}

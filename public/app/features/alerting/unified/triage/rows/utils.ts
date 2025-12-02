import { EmptyLabelValue, LabelValue, WorkbenchRow } from '../types';

// Generate unique keys for WorkbenchRow items
export function generateRowKey(row: WorkbenchRow, fallbackIndex: number): string {
  if (row.type === 'alertRule') {
    // Use ruleUID as primary key for AlertRuleRow
    return `alert-${row.metadata.ruleUID}`;
  } else {
    // For GenericGroupedRow, create key from label and value
    const groupedRow = row;
    return `group-${groupedRow.metadata.label}-${formatLabelValue(groupedRow.metadata.value)}`;
  }
}

export const formatLabelValue = (value: LabelValue): string => (value === EmptyLabelValue ? '<no value>' : value);

export type ColumnOption = 'filter' | 'hide' | 'pin' | 'manage' | 'assistant';

export function getColumnMenuOptions({
  filterable = false,
  hideable = false,
  pinnable = false,
  hasColumnSidebar = false,
  hasAssistantAction = false,
}: {
  filterable?: boolean;
  hideable?: boolean;
  pinnable?: boolean;
  hasColumnSidebar?: boolean;
  hasAssistantAction?: boolean;
}): ColumnOption[][] {
  const filters: ColumnOption[] = [];
  const columns: ColumnOption[] = [];
  const assistant: ColumnOption[] = [];
  if (filterable) {
    filters.push('filter');
  }
  if (hideable) {
    columns.push('hide');
  }
  if (pinnable) {
    columns.push('pin');
  }
  if (hasColumnSidebar) {
    columns.push('manage');
  }
  if (hasAssistantAction) {
    assistant.push('assistant');
  }
  return [filters, columns, assistant].filter((group) => group.length > 0);
}

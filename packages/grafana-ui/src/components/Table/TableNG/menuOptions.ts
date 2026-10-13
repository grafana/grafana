export type ColumnOption = 'filter' | 'hide' | 'manage' | 'assistant';
export type CellOption = 'inspect' | 'filterFor' | 'filterOut' | 'assistant';

export function getColumnMenuOptions({
  filterable = false,
  hideable = false,
  hasColumnSidebar = false,
  hasAssistantAction = false,
}: {
  filterable?: boolean;
  hideable?: boolean;
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
  if (hasColumnSidebar) {
    columns.push('manage');
  }
  if (hasAssistantAction) {
    assistant.push('assistant');
  }
  return [filters, columns, assistant].filter((group) => group.length > 0);
}

export function getCellMenuOptions({
  cellInspect,
  showFilters,
  hasAssistantAction,
}: {
  cellInspect: boolean;
  showFilters: boolean;
  hasAssistantAction: boolean;
}): CellOption[][] {
  const inspect: CellOption[] = [];
  const filters: CellOption[] = [];
  const assistant: CellOption[] = [];
  if (cellInspect) {
    inspect.push('inspect');
  }
  if (showFilters) {
    filters.push('filterFor', 'filterOut');
  }
  if (hasAssistantAction) {
    assistant.push('assistant');
  }
  return [inspect, filters, assistant].filter((group) => group.length > 0);
}

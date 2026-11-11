export type CellOption = 'inspect' | 'filterFor' | 'filterOut' | 'assistant';

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

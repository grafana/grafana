import { type DataTransformerConfig, DataTransformerID, type Field } from '@grafana/data';
import { type SortByTransformerOptions } from '@grafana/data/internal';
import { type SortColumn } from '@grafana/react-data-grid';

import { type TableSortByFieldState } from '../types';

interface TableSortContext {
  frameKey: string;
  frameIndex: number;
  source: { refId?: string; fields: Field[] };
  initialSort?: TableSortByFieldState[];
}

function matchesTableSort(
  config: DataTransformerConfig,
  frameKey: string
): config is DataTransformerConfig<SortByTransformerOptions> {
  return config.id === DataTransformerID.sortBy && config.options.target?.frameKey === frameKey && !config.disabled;
}

export function readTableSort(current: readonly DataTransformerConfig[], context: TableSortContext): SortColumn[] {
  const config = current.find((entry) => matchesTableSort(entry, context.frameKey));
  const sort = config?.options.sort;
  if (!sort) {
    return (context.initialSort ?? []).map(({ displayName, desc }) => ({
      columnKey: displayName,
      direction: desc ? 'DESC' : 'ASC',
    }));
  }
  return sort.map(({ field, displayName, desc }) => ({
    columnKey: displayName ?? field,
    direction: desc ? 'DESC' : 'ASC',
  }));
}

export function writeTableSort(
  current: readonly DataTransformerConfig[],
  next: SortColumn[],
  { frameKey, frameIndex, source }: TableSortContext
): readonly DataTransformerConfig[] {
  const config: DataTransformerConfig<SortByTransformerOptions> = {
    id: DataTransformerID.sortBy,
    options: {
      table: true,
      target: { frameKey, frameIndex, refId: source.refId },
      sort: next.map(({ columnKey, direction }) => {
        const field = source.fields.find((candidate) => (candidate.state?.displayName ?? candidate.name) === columnKey);
        return {
          field: field?.name ?? columnKey,
          displayName: columnKey,
          fieldLabels: field?.labels,
          desc: direction === 'DESC',
        };
      }),
    },
  };
  const existing = current.findIndex((entry) => matchesTableSort(entry, frameKey));
  if (existing >= 0) {
    return current.map((entry, index) => (index === existing ? config : entry));
  }
  const insertion = current.findIndex((entry) => entry.id !== DataTransformerID.filterByValue);
  const index = insertion < 0 ? current.length : insertion;
  return [...current.slice(0, index), config, ...current.slice(index)];
}

import { type DataQuery } from '@grafana/schema';

import { QueryEditorType } from '../../constants';
import { type StackedEditorItem } from '../QueryEditorContext';
import { type Transformation } from '../types';
import { getEditorType } from '../utils';

/**
 * Renderer-side counterpart of {@link StackedEditorItem} that carries the actual data payload.
 * `StackedEditorItem` (identity-only) is what the public context API speaks; `StackedItem` is what
 * the renderer iterates over.
 */
export type StackedItem = StackedEditorItem &
  (
    | { type: QueryEditorType.Query | QueryEditorType.Expression; query: DataQuery }
    | { type: QueryEditorType.Transformation; transformation: Transformation }
  );

export function getStackedItemKey(item: StackedEditorItem): string {
  return `${item.type}:${item.id}`;
}

/** Validates a raw string (e.g. from a DOM data attribute) against the StackedEditorItem type enum. */
export function parseStackedItemType(type: string | null): StackedEditorItem['type'] | null {
  switch (type) {
    case QueryEditorType.Query:
    case QueryEditorType.Expression:
    case QueryEditorType.Transformation:
      return type;
    default:
      return null;
  }
}

export function getStackedQueryEditorType(query: DataQuery): QueryEditorType.Query | QueryEditorType.Expression {
  return getEditorType(query) === QueryEditorType.Expression ? QueryEditorType.Expression : QueryEditorType.Query;
}

export function isCurrentStackedItem({
  item,
  selectedQueryRefId,
  selectedTransformationId,
}: {
  item: StackedEditorItem;
  selectedQueryRefId?: string;
  selectedTransformationId?: string;
}): boolean {
  return item.type === QueryEditorType.Transformation
    ? item.id === selectedTransformationId
    : item.id === selectedQueryRefId;
}

/** Stable primitive key — safe to use in effect dep arrays without re-running on every keystroke. */
export function getStackedItemsKey(items: readonly StackedEditorItem[]): string {
  return items.map(getStackedItemKey).join('|');
}

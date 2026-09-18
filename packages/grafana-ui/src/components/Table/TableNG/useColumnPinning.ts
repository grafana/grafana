import { useCallback, useMemo, useState } from 'react';

interface PinState {
  configuredCount: number;
  pinned: ReadonlySet<string>;
}

interface Options {
  frameKey: string;
  columns: string[];
  hiddenColumns: ReadonlySet<string>;
  frozenColumns: number;
  enabled: boolean;
  onColumnOrderChange: (order: string[]) => void;
}

const pinnedFirst = (columns: string[], pinned: ReadonlySet<string>) => [
  ...columns.filter((name) => pinned.has(name)),
  ...columns.filter((name) => !pinned.has(name)),
];

/** Pin membership is view state; only the resulting field order belongs in transformations. */
export function useColumnPinning({
  frameKey,
  columns,
  hiddenColumns,
  frozenColumns,
  enabled,
  onColumnOrderChange,
}: Options) {
  const [frames, setFrames] = useState<Map<string, PinState>>(() => new Map());
  let state = frames.get(frameKey);
  if (!state || state.configuredCount !== frozenColumns) {
    state = { configuredCount: frozenColumns, pinned: new Set(columns.slice(0, Math.max(0, frozenColumns))) };
    setFrames(new Map(frames).set(frameKey, state));
  }
  const current = state;
  const pinnedColumns = current.pinned;
  const togglePin = useCallback(
    (name: string) => {
      if (!enabled || !columns.includes(name)) {
        return;
      }
      const pinned = new Set(current.pinned);
      if (pinned.has(name)) {
        pinned.delete(name);
      } else {
        pinned.add(name);
      }
      setFrames((frames) => new Map(frames).set(frameKey, { ...current, pinned }));
      onColumnOrderChange(pinnedFirst(columns, pinned));
    },
    [columns, current, enabled, frameKey, onColumnOrderChange]
  );
  const reorder = useCallback(
    (order: string[]) => {
      if (!enabled) {
        onColumnOrderChange(order);
        return;
      }
      onColumnOrderChange(pinnedFirst(order, current.pinned));
    },
    [current, enabled, onColumnOrderChange]
  );
  const visibleFrozenCount = useMemo(
    () =>
      enabled ? columns.filter((name) => pinnedColumns.has(name) && !hiddenColumns.has(name)).length : frozenColumns,
    [columns, enabled, frozenColumns, hiddenColumns, pinnedColumns]
  );
  return { pinnedColumns, frozenColumns: visibleFrozenCount, togglePin, reorder };
}

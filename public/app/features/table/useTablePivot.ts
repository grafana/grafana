import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { type DataFrame, DataTransformerID, type DataTransformerConfig } from '@grafana/data';
import { getPivotProvenance, pivotFrame, type PivotOptions } from '@grafana/data/internal';
import { type TableSortByFieldState } from '@grafana/schema';
import { usePanelContext } from '@grafana/ui';

import { TABLE_TRANSFORMATIONS_OWNER, useTableFrameScope } from './hooks';

const EMPTY_TRANSFORMATIONS: readonly DataTransformerConfig[] = [];
function isTablePivot(config: DataTransformerConfig): config is DataTransformerConfig<PivotOptions> {
  return config.id === DataTransformerID.pivot && Boolean(config.options?.tablePivot) && !config.disabled;
}
export const emptyPivot = (): PivotOptions => ({
  frameIndex: 0,
  rows: [],
  columns: [],
  values: [],
  totalRow: true,
  totalColumns: true,
});

export function useTablePivot(
  frames: readonly DataFrame[],
  output: DataFrame | undefined,
  frameIndex: number,
  enabled: boolean,
  disabledReason?: string,
  initialSort: TableSortByFieldState[] = []
) {
  const api = usePanelContext().adHocTransformations;
  const [selected, setSelected] = useState(false);
  const [draft, setDraft] = useState(emptyPivot);
  const configs = useSyncExternalStore(
    useCallback((listener) => api?.subscribe(TABLE_TRANSFORMATIONS_OWNER, listener) ?? (() => {}), [api]),
    useCallback(() => api?.get(TABLE_TRANSFORMATIONS_OWNER) ?? EMPTY_TRANSFORMATIONS, [api])
  );
  const applied = configs.find(isTablePivot)?.options;
  const [error, setError] = useState<string>();
  const identity = useTableFrameScope(frames)(frameIndex);
  const previousIdentity = useRef(identity);
  const source = output && (getPivotProvenance(output)?.source ?? output);
  const clear = useCallback(() => {
    if (!api) {
      return;
    }
    const current = api.get(TABLE_TRANSFORMATIONS_OWNER);
    const next = current.filter((config) => !(config.id === DataTransformerID.pivot && config.options.tablePivot));
    if (next.length !== current.length) {
      api.set(TABLE_TRANSFORMATIONS_OWNER, next);
    }
  }, [api]);
  useEffect(() => {
    if (!enabled || disabledReason || previousIdentity.current !== identity) {
      clear();
      setSelected(false);
      setDraft(emptyPivot());
      setError(undefined);
    }
    previousIdentity.current = identity;
  }, [enabled, disabledReason, identity, clear]);
  const select = (value: boolean) => {
    clear();
    setError(undefined);
    setSelected(value);
  };
  const apply = () => {
    if (!source || !api || !enabled || disabledReason) {
      return;
    }
    const next = { ...draft, frameIndex };
    try {
      pivotFrame(source, next);
      clear();
      const stage = [...api.get(TABLE_TRANSFORMATIONS_OWNER)];
      if (
        initialSort.length &&
        !stage.some((config) => config.id === DataTransformerID.sortBy && config.options.target?.frameKey === identity)
      ) {
        const index = stage.findIndex((config) => config.id === DataTransformerID.organize);
        stage.splice(index < 0 ? stage.length : index, 0, {
          id: DataTransformerID.sortBy,
          options: {
            table: true,
            target: { frameKey: identity, frameIndex, refId: frames[frameIndex]?.refId },
            sort: initialSort.map((sort) => ({ field: sort.displayName, desc: sort.desc })),
          },
        });
      }
      api.set(TABLE_TRANSFORMATIONS_OWNER, [
        ...stage,
        { id: DataTransformerID.pivot, options: { ...next, tablePivot: true } },
      ]);
      setError(undefined);
    } catch (error) {
      setError(String(error));
    }
  };
  return {
    selected: enabled && (selected || Boolean(applied)) && !disabledReason && previousIdentity.current === identity,
    draft,
    setDraft,
    applied,
    source,
    error,
    select,
    apply,
  };
}

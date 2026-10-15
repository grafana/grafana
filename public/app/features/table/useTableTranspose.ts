import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { DataTransformerID, FieldType, type DataFrame, type DataTransformerConfig } from '@grafana/data';
import { t } from '@grafana/i18n';
import { type TableSortByFieldState } from '@grafana/schema';
import { usePanelContext } from '@grafana/ui';

import { TABLE_TRANSFORMATIONS_OWNER, useTableFrameScope } from './hooks';

// The marker distinguishes this control from transpose operations supplied by other consumers.
const TRANSPOSE_MARKER = 'tableTranspose';
const EMPTY_TRANSFORMATIONS: readonly DataTransformerConfig[] = [];

export function withoutTableTranspose(stage: readonly DataTransformerConfig[]): DataTransformerConfig[] {
  return stage.filter((config) => !(config.id === DataTransformerID.transpose && config.options?.[TRANSPOSE_MARKER]));
}

export function useTableTranspose(
  frames: readonly DataFrame[],
  frameIndex: number,
  enabled: boolean,
  initialSort: TableSortByFieldState[] = []
) {
  const api = usePanelContext().adHocTransformations;
  const [rowsActive, setRowsActive] = useState(false);
  const [fieldSettings, setFieldSettings] = useState<'rows' | 'columns'>('rows');
  const configs = useSyncExternalStore(
    useCallback((listener) => api?.subscribe(TABLE_TRANSFORMATIONS_OWNER, listener) ?? (() => {}), [api]),
    useCallback(() => api?.get(TABLE_TRANSFORMATIONS_OWNER) ?? EMPTY_TRANSFORMATIONS, [api])
  );
  const columnsActive = configs.some(
    (config) => config.id === DataTransformerID.transpose && config.options?.[TRANSPOSE_MARKER] && !config.disabled
  );
  const active = rowsActive || columnsActive;
  const currentFieldSettings = columnsActive ? 'columns' : fieldSettings;
  const frame = frames[frameIndex];
  const identity = useTableFrameScope(frames)(frameIndex);
  const previousIdentity = useRef(identity);
  const disabledReason = !api
    ? t('table.transpose.no-api', 'Transpose is only available in dashboard tables.')
    : frame?.fields.some((field) => field.type === FieldType.nestedFrames)
      ? t('table.transpose.nested', 'Transpose is not available for nested tables.')
      : !frame?.fields.length
        ? t('table.transpose.empty', 'Transpose requires fields.')
        : undefined;

  const clear = useCallback(() => {
    if (api) {
      const current = api.get(TABLE_TRANSFORMATIONS_OWNER);
      const next = withoutTableTranspose(current);
      if (next.length !== current.length) {
        api.set(TABLE_TRANSFORMATIONS_OWNER, next);
      }
    }
  }, [api]);

  useEffect(() => {
    if (!enabled || disabledReason || previousIdentity.current !== identity) {
      setRowsActive(false);
      clear();
    }
    previousIdentity.current = identity;
  }, [enabled, disabledReason, identity, clear]);

  const update = (nextActive: boolean, nextSettings: 'rows' | 'columns') => {
    if (!enabled || disabledReason || !api) {
      return;
    }
    const stage = withoutTableTranspose(api.get(TABLE_TRANSFORMATIONS_OWNER));
    if (
      nextActive &&
      nextSettings === 'columns' &&
      initialSort.length &&
      !stage.some((config) => config.id === DataTransformerID.sortBy && config.options.target?.frameKey === identity)
    ) {
      const index = stage.findIndex((config) => config.id === DataTransformerID.organize);
      stage.splice(index < 0 ? stage.length : index, 0, {
        id: DataTransformerID.sortBy,
        options: {
          table: true,
          target: { frameKey: identity, frameIndex, refId: frame?.refId },
          sort: initialSort.map((sort) => ({ field: sort.displayName, desc: sort.desc })),
        },
      });
    }
    api.set(
      TABLE_TRANSFORMATIONS_OWNER,
      nextActive && nextSettings === 'columns'
        ? [
            ...stage,
            {
              id: DataTransformerID.transpose,
              options: { [TRANSPOSE_MARKER]: true, frameIndex },
            },
          ]
        : stage
    );
    setRowsActive(nextActive && nextSettings === 'rows');
    setFieldSettings(nextSettings);
  };

  return {
    enabled: enabled && active && !disabledReason && previousIdentity.current === identity,
    fieldSettings: currentFieldSettings,
    disabledReason,
    onToggle: (value: boolean) => update(value, currentFieldSettings),
    onFieldSettingsChange: (value: 'rows' | 'columns') => update(active, value),
  };
}

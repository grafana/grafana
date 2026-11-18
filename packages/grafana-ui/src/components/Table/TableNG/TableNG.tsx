import { css } from '@emotion/css';
import { Suspense, useMemo, useRef } from 'react';

import { cacheFieldDisplayNames, type DataFrame, type Field, FieldType } from '@grafana/data';

import { useStyles2 } from '../../../themes/ThemeContext';
import { hasGeoCell, LazyOpenLayersProvider } from '../geo';

import { TableFilterProvider } from './TableFilterContext';
import { TableFlat } from './TableFlat';
import { TableNested } from './TableNested';
import { IS_SAFARI_26 } from './styles';
import { type TableNGProps } from './types';
import { getDisplayName } from './utils';

// Display names are cached (or not) across the whole frame at once, so a sample of the first
// fields is enough to tell whether a consumer already called `cacheFieldDisplayNames` — no need
// to scan every field on wide frames.
const DISPLAY_NAME_SNIFF_LIMIT = 10;

function hasCachedDisplayNames(data: DataFrame): boolean {
  const limit = Math.min(data.fields.length, DISPLAY_NAME_SNIFF_LIMIT);
  for (let i = 0; i < limit; i++) {
    if (!data.fields[i].state?.displayName) {
      return false;
    }
  }
  return true;
}

// Safari 26 shipped with a bug that prevents the table from rendering correctly
// unless it is wrapped in a container with `contain: strict`.
function Safari26Wrapper(props: { children: React.ReactNode }) {
  const className = useStyles2(() => css({ contain: 'strict', height: '100%' }));
  return <div className={className}>{props.children}</div>;
}

export function TableNG(props: TableNGProps) {
  const preparedFrames = useRef({
    structureRev: props.structureRev,
    cache: new WeakMap<
      DataFrame,
      {
        fields: Field[];
        values: Array<Field['values']>;
        configs: Array<Field['config']>;
        length: number;
        name?: string;
        refId?: string;
        meta?: DataFrame['meta'];
        prepared: DataFrame;
      }
    >(),
  });
  if (preparedFrames.current.structureRev !== props.structureRev) {
    preparedFrames.current.structureRev = props.structureRev;
    preparedFrames.current.cache = new WeakMap();
  }
  const frameCache = preparedFrames.current.cache;
  const data = useMemo(() => {
    if (
      !props.rowTransformationsEnabled &&
      !props.data.fields.some((field) => field.config.custom?.filterable || field.type === FieldType.nestedFrames)
    ) {
      return props.data;
    }
    const frame = props.data;
    const prepare = (frame: DataFrame): DataFrame => {
      const hasNestedFrames = frame.fields.some((field) => field.type === FieldType.nestedFrames);
      const cached = hasNestedFrames || !props.rowTransformationsEnabled ? undefined : frameCache.get(frame);
      if (
        cached?.fields === frame.fields &&
        cached.length === frame.length &&
        cached.name === frame.name &&
        cached.refId === frame.refId &&
        cached.meta === frame.meta &&
        frame.fields.every(
          (field, index) => field.values === cached.values[index] && field.config === cached.configs[index]
        )
      ) {
        return cached.prepared;
      }
      if (!hasCachedDisplayNames(frame)) {
        cacheFieldDisplayNames([frame]);
      }
      const names = frame.fields.map(getDisplayName);
      const identities = frame.fields.map((field) => JSON.stringify([field.name, field.labels]));
      const duplicates = (values: string[]) => {
        const seen = new Set<string>();
        const repeated = new Set<string>();
        for (const value of values) {
          if (seen.has(value)) {
            repeated.add(value);
          }
          seen.add(value);
        }
        return repeated;
      };
      const duplicateNames = duplicates(names);
      const duplicateIdentities = duplicates(identities);
      if (!props.rowTransformationsEnabled) {
        const fields = frame.fields.map((field, index) => {
          const ambiguous = duplicateNames.has(names[index]) || duplicateIdentities.has(identities[index]);
          if (!ambiguous && field.type !== FieldType.nestedFrames) {
            return field;
          }
          return {
            ...field,
            ...(field.type === FieldType.nestedFrames
              ? { values: field.values.map((children: DataFrame[] | undefined) => children?.map(prepare)) }
              : {}),
            ...(ambiguous
              ? { config: { ...field.config, custom: { ...field.config.custom, filterable: false } } }
              : {}),
          };
        });
        return fields.every((field, index) => field === frame.fields[index]) ? frame : { ...frame, fields };
      }
      const prepared = {
        ...frame,
        fields: frame.fields.map((field, index) => ({
          ...field,
          ...(field.type === FieldType.nestedFrames
            ? { values: field.values.map((children: DataFrame[] | undefined) => children?.map(prepare)) }
            : {}),
          config: {
            ...field.config,
            custom: {
              ...field.config.custom,
              filterable:
                !duplicateNames.has(names[index]) &&
                !duplicateIdentities.has(identities[index]) &&
                (field.config.custom?.filterable ?? true),
              sortable:
                !duplicateNames.has(names[index]) &&
                !duplicateIdentities.has(identities[index]) &&
                field.config.custom?.sortable !== false,
            },
          },
        })),
      };
      if (!hasNestedFrames) {
        frameCache.set(frame, {
          fields: frame.fields,
          values: frame.fields.map((field) => field.values),
          configs: frame.fields.map((field) => field.config),
          length: frame.length,
          name: frame.name,
          refId: frame.refId,
          meta: frame.meta,
          prepared,
        });
      }
      return prepared;
    };
    return prepare(frame);
  }, [props.data, props.rowTransformationsEnabled, frameCache]);

  // runs during render (before TableFlat/TableNested read field.state), not after commit —
  // otherwise their own memoized row/column builders capture the pre-cache values and never see
  // the update, since cacheFieldDisplayNames mutates field.state in place without triggering a
  // re-render on its own.
  useMemo(() => {
    if (hasCachedDisplayNames(data)) {
      return;
    }
    cacheFieldDisplayNames([data]);
  }, [data]);

  const nestedDataField = useMemo(() => data.fields.find((f) => f.type === FieldType.nestedFrames), [data.fields]);
  const tableHasGeoCell = useMemo(() => hasGeoCell(data), [data]);

  const inner = nestedDataField ? (
    <TableNested {...props} data={data} nestedFramesField={nestedDataField} />
  ) : (
    <TableFlat {...props} data={data} />
  );
  const rendered = IS_SAFARI_26 ? <Safari26Wrapper>{inner}</Safari26Wrapper> : inner;
  const table = tableHasGeoCell ? (
    <Suspense fallback={rendered}>
      <LazyOpenLayersProvider>{rendered}</LazyOpenLayersProvider>
    </Suspense>
  ) : (
    rendered
  );

  return <TableFilterProvider props={props}>{table}</TableFilterProvider>;
}

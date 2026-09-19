import { css } from '@emotion/css';
import { Suspense, useMemo } from 'react';

import { cacheFieldDisplayNames, type DataFrame, FieldType } from '@grafana/data';

import { useStyles2 } from '../../../themes/ThemeContext';
import { hasGeoCell, LazyOpenLayersProvider } from '../geo';

import { TableFlat } from './TableFlat';
import { TableNested } from './TableNested';
import { TableViewProvider } from './TableViewContext';
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
  const source = useMemo(() => {
    if (!props.rowTransformationsEnabled) {
      return props.data;
    }
    const frame = props.data;
    const prepare = (frame: DataFrame): DataFrame => {
      cacheFieldDisplayNames([frame]);
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
      return {
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
    };
    return prepare(frame);
  }, [props.data, props.rowTransformationsEnabled]);
  if (props.rowTransformationsEnabled) {
    return (
      <TableViewProvider props={props}>
        <TableView {...props} data={source} />
      </TableViewProvider>
    );
  }
  return <TableView {...props} />;
}

function TableView(props: TableNGProps) {
  const { data, width } = props;

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
    <TableNested {...props} width={width} nestedFramesField={nestedDataField} />
  ) : (
    <TableFlat {...props} width={width} />
  );
  const rendered = IS_SAFARI_26 ? <Safari26Wrapper>{inner}</Safari26Wrapper> : inner;

  if (!tableHasGeoCell) {
    return rendered;
  }

  return (
    <Suspense fallback={rendered}>
      <LazyOpenLayersProvider>{rendered}</LazyOpenLayersProvider>
    </Suspense>
  );
}

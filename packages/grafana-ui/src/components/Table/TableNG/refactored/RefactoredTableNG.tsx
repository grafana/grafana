import { css } from '@emotion/css';
import { Suspense, useMemo } from 'react';

import { type Field, FieldType } from '@grafana/data';

import { useStyles2 } from '../../../../themes/ThemeContext';
import { hasGeoCell, LazyOpenLayersProvider } from '../../geo';
import { RESIZE_WIDTH_DEBOUNCE_MS, useDebouncedNumber } from '../hooks';
import { IS_SAFARI_26 } from '../styles';
import { type TableNGProps } from '../types';
import { getVisibleFields, shouldDebounceWidth } from '../utils';

import { TableFlat } from './TableFlat';
import { TableNested } from './TableNested';

// Safari 26 shipped with a bug that prevents the table from rendering correctly
// unless it is wrapped in a container with `contain: strict`.
function Safari26Wrapper(props: { children: React.ReactNode }) {
  const className = useStyles2(() => css({ contain: 'strict', height: '100%' }));
  return <div className={className}>{props.children}</div>;
}

// The debounce costs a frame of staleness on every resize, so it lives in a wrapper we only mount
// for the layouts which are expensive to re-apply. Tables without one don't run the timer at all.
function DebouncedWidth({ width, children }: { width: number; children: (width: number) => React.ReactNode }) {
  return <>{children(useDebouncedNumber(width, RESIZE_WIDTH_DEBOUNCE_MS))}</>;
}

export function RefactoredTableNG(props: TableNGProps) {
  const { data, width } = props;

  const nestedDataField = useMemo(() => data.fields.find((f) => f.type === FieldType.nestedFrames), [data.fields]);
  const tableHasGeoCell = useMemo(() => hasGeoCell(data), [data]);

  const needsDebounce = useMemo(() => {
    // nested grids size their auto columns off the same panel width, so either level can require it.
    const nestedFields: Field[] = nestedDataField?.values[0]?.[0]?.fields ?? [];
    return shouldDebounceWidth(getVisibleFields(data.fields)) || shouldDebounceWidth(getVisibleFields(nestedFields));
  }, [data.fields, nestedDataField]);

  const renderTable = (tableWidth: number) =>
    nestedDataField ? (
      <TableNested {...props} width={tableWidth} nestedFramesField={nestedDataField} />
    ) : (
      <TableFlat {...props} width={tableWidth} />
    );

  const inner = needsDebounce ? <DebouncedWidth width={width}>{renderTable}</DebouncedWidth> : renderTable(width);
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

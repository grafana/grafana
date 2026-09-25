import { css } from '@emotion/css';
import { Suspense, useMemo } from 'react';

import { cacheFieldDisplayNames, type DataFrame, FieldType } from '@grafana/data';

import { useStyles2 } from '../../../themes/ThemeContext';
import { hasGeoCell, LazyOpenLayersProvider } from '../geo';

import { TableFlat } from './TableFlat';
import { TableNested } from './TableNested';
import { IS_SAFARI_26 } from './styles';
import { type TableNGProps } from './types';

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

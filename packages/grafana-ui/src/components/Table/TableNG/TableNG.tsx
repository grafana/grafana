import { css } from '@emotion/css';
import { Suspense, useMemo } from 'react';

import { cacheFieldDisplayNames, FieldType } from '@grafana/data';

import { useStyles2 } from '../../../themes/ThemeContext';
import { hasGeoCell, LazyOpenLayersProvider } from '../geo';

import { TableFlat } from './TableFlat';
import { TableNested } from './TableNested';
import { IS_SAFARI_26 } from './styles';
import { type TableNGProps } from './types';

// Safari 26 shipped with a bug that prevents the table from rendering correctly
// unless it is wrapped in a container with `contain: strict`.
function Safari26Wrapper(props: { children: React.ReactNode }) {
  const className = useStyles2(() => css({ contain: 'strict', height: '100%' }));
  return <div className={className}>{props.children}</div>;
}

export function TableNG(props: TableNGProps) {
  const { data, width, assumeCachedDisplayNames } = props;

  // runs during render (before TableFlat/TableNested read field.state), not after commit —
  // otherwise their own memoized row/column builders capture the pre-cache values and never see
  // the update, since cacheFieldDisplayNames mutates field.state in place without triggering a
  // re-render on its own.
  useMemo(() => {
    if (assumeCachedDisplayNames) {
      return;
    }
    cacheFieldDisplayNames([data]);
  }, [data, assumeCachedDisplayNames]);

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

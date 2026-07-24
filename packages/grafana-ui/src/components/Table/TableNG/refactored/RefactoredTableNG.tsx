import { css } from '@emotion/css';
import { Suspense, useMemo } from 'react';

import { FieldType } from '@grafana/data';

import { useStyles2 } from '../../../../themes/ThemeContext';
import { hasGeoCell, LazyOpenLayersProvider } from '../../geo';
import { IS_SAFARI_26 } from '../styles';
import { type TableNGProps } from '../types';

import { TableFlat } from './TableFlat';
import { TableNested } from './TableNested';

// Safari 26 shipped with a bug that prevents the table from rendering correctly
// unless it is wrapped in a container with `contain: strict`.
function Safari26Wrapper(props: { children: React.ReactNode }) {
  const className = useStyles2(() => css({ contain: 'strict', height: '100%' }));
  return <div className={className}>{props.children}</div>;
}

export function RefactoredTableNG(props: TableNGProps) {
  const { data } = props;

  const nestedDataField = useMemo(() => data.fields.find((f) => f.type === FieldType.nestedFrames), [data.fields]);
  const tableHasGeoCell = useMemo(() => hasGeoCell(data), [data]);

  const inner = nestedDataField ? (
    <TableNested {...props} nestedFramesField={nestedDataField} />
  ) : (
    <TableFlat {...props} />
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

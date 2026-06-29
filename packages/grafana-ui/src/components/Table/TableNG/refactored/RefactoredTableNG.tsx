import { Suspense, useMemo } from 'react';

import { FieldType } from '@grafana/data';

import { hasGeoCell, LazyOpenLayersProvider } from '../../geo';
import { IS_SAFARI_26 } from '../styles';
import { type TableNGProps } from '../types';

import { Safari26Wrapper } from './Safari26Wrapper';
import { TableFlat } from './TableFlat';
import { TableNested } from './TableNested';
import { TableSizeContainer } from './TableSizeContainer';

export function RefactoredTableNG(props: TableNGProps) {
  const { data, width, height } = props;

  const nestedDataField = useMemo(() => data.fields.find((f) => f.type === FieldType.nestedFrames), [data.fields]);
  const tableHasGeoCell = useMemo(() => hasGeoCell(data), [data]);

  const inner = nestedDataField ? (
    <TableNested {...props} nestedFramesField={nestedDataField} />
  ) : (
    <TableFlat {...props} />
  );
  const rendered = IS_SAFARI_26 ? <Safari26Wrapper>{inner}</Safari26Wrapper> : inner;

  return (
    <TableSizeContainer width={width} height={height}>
      {tableHasGeoCell ? (
        <Suspense fallback={rendered}>
          <LazyOpenLayersProvider>{rendered}</LazyOpenLayersProvider>
        </Suspense>
      ) : (
        rendered
      )}
    </TableSizeContainer>
  );
}

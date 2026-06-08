import { Suspense, useMemo } from 'react';

import { FieldType } from '@grafana/data';

import { useStyles2 } from '../../../themes/ThemeContext';
import { hasGeoCell, LazyOpenLayersProvider } from '../geo';

import { TableFlat } from './TableFlat';
import { TableNested } from './TableNested';
import { getGridStyles, IS_SAFARI_26 } from './styles';
import { type TableNGProps } from './types';

export function TableNG(props: TableNGProps) {
  const { data, transparent } = props;
  // useStyles2 is always called (Rules of Hooks) even though only safariWrapper is consumed here.
  // Child components call useStyles2 independently with the correct showPagination value.
  const styles = useStyles2(getGridStyles, false, transparent);
  const nestedDataField = useMemo(() => data.fields.find((f) => f.type === FieldType.nestedFrames), [data.fields]);
  const tableHasGeoCell = useMemo(() => hasGeoCell(data), [data]);

  const inner = nestedDataField ? (
    <TableNested {...props} nestedFramesField={nestedDataField} />
  ) : (
    <TableFlat {...props} />
  );
  const rendered = IS_SAFARI_26 ? <div className={styles.safariWrapper}>{inner}</div> : inner;

  if (!tableHasGeoCell) {
    return rendered;
  }

  return (
    <Suspense fallback={rendered}>
      <LazyOpenLayersProvider>{rendered}</LazyOpenLayersProvider>
    </Suspense>
  );
}

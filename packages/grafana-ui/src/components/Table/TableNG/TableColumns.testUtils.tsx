import { useState } from 'react';

import { applyFieldOverrides, createDataFrame, createTheme, FieldType } from '@grafana/data';

import { TableNG } from './TableNG';

export function Harness({
  revision = 0,
  reorderable = true,
  hideable = true,
}: {
  revision?: number;
  reorderable?: boolean;
  hideable?: boolean;
}) {
  const [hiddenColumns, setHiddenColumns] = useState<ReadonlySet<string>>(new Set());
  const [columnOrder, setColumnOrder] = useState<string[]>();
  const source = createDataFrame({
    fields: ['A', 'B', 'C'].map((name) => ({
      name,
      type: FieldType.string,
      values: [`${name}${revision}`],
      config: { custom: { hideable } },
    })),
  });
  const data = applyFieldOverrides({
    data: [source],
    fieldConfig: { defaults: {}, overrides: [] },
    theme: createTheme(),
    timeZone: 'utc',
    replaceVariables: (value) => value,
  })[0];
  return (
    <TableNG
      data={data}
      width={800}
      height={400}
      tableRefreshEnabled
      reorderable={reorderable}
      showColumnsSidebar
      hiddenColumns={hiddenColumns}
      columnOrder={columnOrder}
      onColumnOrderChange={setColumnOrder}
      onHiddenColumnsChange={setHiddenColumns}
      columnCatalog={['A', 'B', 'C']}
      structureRev={revision}
    />
  );
}

import React from 'react';
import { CellProps } from 'react-table';

import { useDatasource } from '../utils/useDatasource';
import { QueryTemplateRow } from '../utils/view';

export function DatasourceTypeCell(props: CellProps<QueryTemplateRow>) {
  const datasource = props.row.original.queryTemplate?.targets[0]?.datasource;
  const { datasourceApi } = useDatasource(datasource);

  return <p>{datasourceApi?.meta.name}</p>;
}

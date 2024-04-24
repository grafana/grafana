import { css } from '@emotion/css';
import React from 'react';
import { SortByFn } from 'react-table';

import { Column, InteractiveTable } from '@grafana/ui';

import { ActionsCell } from './ActionsCell';
import { AddedByCell } from './AddedByCell';
import { DatasourceTypeCell } from './DatasourceTypeCell';
import { DateAddedCell } from './DateAddedCell';
import { QueryDescriptionCell } from './QueryDescriptionCell';
import { QueryTemplateRow } from './types';

const timestampSort: SortByFn<QueryTemplateRow> = (rowA, rowB, _, desc) => {
  const timeA = rowA.original.queryTemplate?.createdAtTimestamp || 0;
  const timeB = rowB.original.queryTemplate?.createdAtTimestamp || 0;
  return desc ? timeA - timeB : timeB - timeA;
};

const columns: Array<Column<QueryTemplateRow>> = [
  { id: 'query', header: 'Data source and query', cell: QueryDescriptionCell },
  { id: 'addedBy', header: 'Added by', cell: AddedByCell },
  { id: 'datasourceType', header: 'Datasource type', cell: DatasourceTypeCell, sortType: 'string' },
  { id: 'dateAdded', header: 'Date added', cell: DateAddedCell, sortType: timestampSort },
  { id: 'actions', header: '', cell: ActionsCell },
];

const styles = {
  tableWithSpacing: css({
    'th:first-child': {
      width: '50%',
    },
  }),
};

type Props = {
  queryTemplateRows: QueryTemplateRow[];
};

export default function QueryTemplatesTable({ queryTemplateRows }: Props) {
  return (
    <InteractiveTable
      className={styles.tableWithSpacing}
      columns={columns}
      data={queryTemplateRows}
      getRowId={(row: { index: string }) => row.index}
    />
  );
}

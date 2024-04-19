import React from 'react';
import { CellProps } from 'react-table';

import { QueryTemplateRow } from '../utils/view';

export function DateAddedCell(props: CellProps<QueryTemplateRow>) {
  return <span>{props.row.original.queryTemplate?.createdAt}</span>;
}

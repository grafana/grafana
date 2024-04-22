import React from 'react';
import { CellProps } from 'react-table';

import { QueryTemplateRow } from '../utils/view';

import { Cell } from './Cell';

export function DateAddedCell(props: CellProps<QueryTemplateRow>) {
  return <Cell>{props.row.original.queryTemplate?.createdAt}</Cell>;
}

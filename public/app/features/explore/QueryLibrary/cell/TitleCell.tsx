import React from 'react';
import { CellProps } from 'react-table';

import { useDatasource } from '../utils/useDatasource';
import { QueryTemplateRow } from '../utils/view';

import { Cell } from './Cell';

export function TitleCell(props: CellProps<QueryTemplateRow>) {
  const datasource = props.row.original.queryTemplate?.targets[0]?.datasource;
  const { datasourceApi, type } = useDatasource(datasource);

  if (props.row.original.queryTemplate?.targets.length === 0) {
    return <div>No queries</div>;
  }
  const firstQuery = props.row.original.queryTemplate?.targets[0]!;

  return (
    <Cell>
      <p>
        <img width="16" src={datasourceApi?.meta.info.logos.small || 'public/img/icn-datasource.svg'} alt="" />
        {datasourceApi?.name}
      </p>
      <p>{datasourceApi?.getQueryDisplayText?.(firstQuery)}</p>
      <p>{props.row.original.queryTemplate?.title}</p>
    </Cell>
  );
}

import React from 'react';
import { CellProps } from 'react-table';

import { useDatasource } from '../utils/useDatasource';
import { QueryTemplateRow } from '../utils/view';

import { useQueryLibraryListStyles } from './styles';

export function DatasourceTypeCell(props: CellProps<QueryTemplateRow>) {
  const datasource = props.row.original.queryTemplate?.targets[0]?.datasource;
  const datasourceApi = useDatasource(datasource);
  const styles = useQueryLibraryListStyles();

  return <p className={styles.otherText}>{datasourceApi?.meta.name}</p>;
}

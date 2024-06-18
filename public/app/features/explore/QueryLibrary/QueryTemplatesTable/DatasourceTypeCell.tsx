import React from 'react';
import { CellProps } from 'react-table';

import { useDatasource } from '../utils/useDatasource';

import { useQueryLibraryListStyles } from './styles';
import { QueryTemplateRow } from './types';

export function DatasourceTypeCell(props: CellProps<QueryTemplateRow>) {
  const datasourceApi = useDatasource(props.row.original.datasourceRef);
  const styles = useQueryLibraryListStyles();

  return <p className={styles.otherText}>{datasourceApi?.meta.name}</p>;
}

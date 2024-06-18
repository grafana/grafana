import React from 'react';
import { CellProps } from 'react-table';

import { dateTime } from '@grafana/data';

import { useQueryLibraryListStyles } from './styles';
import { QueryTemplateRow } from './types';

export function DateAddedCell(props: CellProps<QueryTemplateRow>) {
  const styles = useQueryLibraryListStyles();
  const formattedTime = dateTime(props.row.original.createdAtTimestamp).format('YYYY-MM-DD HH:mm:ss');

  return <p className={styles.otherText}>{formattedTime}</p>;
}

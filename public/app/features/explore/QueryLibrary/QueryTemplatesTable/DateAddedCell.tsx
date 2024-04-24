import React from 'react';
import { CellProps } from 'react-table';

import { QueryTemplateRow } from '../utils/view';

import { useQueryLibraryListStyles } from './styles';

export function DateAddedCell(props: CellProps<QueryTemplateRow>) {
  const styles = useQueryLibraryListStyles();

  return <p className={styles.otherText}>{props.value}</p>;
}

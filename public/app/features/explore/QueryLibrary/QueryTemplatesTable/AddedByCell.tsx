import React from 'react';
import { CellProps } from 'react-table';

import { Avatar } from '@grafana/ui';

import { useQueryLibraryListStyles } from './styles';
import { QueryTemplateRow } from './types';

export function AddedByCell(props: CellProps<QueryTemplateRow>) {
  const styles = useQueryLibraryListStyles();

  return (
    <div>
      <span className={styles.logo}>
        <Avatar src="https://secure.gravatar.com/avatar" alt="unknown" />
      </span>
      <span className={styles.otherText}>{props.row.original.createdBy}</span>
    </div>
  );
}

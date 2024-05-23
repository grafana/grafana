import React from 'react';

import { Avatar } from '@grafana/ui';
import { User } from 'app/features/query-library/api/types';

import { useQueryLibraryListStyles } from './styles';
type AddedByCellProps = {
  user?: User;
};
export function AddedByCell(props: AddedByCellProps) {
  const styles = useQueryLibraryListStyles();

  return (
    <div>
      <span className={styles.logo}>
        <Avatar src="https://secure.gravatar.com/avatar" alt="unknown" />
      </span>
      <span className={styles.otherText}>{props.user?.login || 'Unknown'}</span>
    </div>
  );
}

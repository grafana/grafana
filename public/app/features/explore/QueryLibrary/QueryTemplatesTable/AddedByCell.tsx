import React from 'react';

import { User } from 'app/features/query-library/api/types';

import { useQueryLibraryListStyles } from './styles';

type AddedByCellProps = {
  user?: User;
};
export function AddedByCell(props: AddedByCellProps) {
  const styles = useQueryLibraryListStyles();

  return (
    <div>
      <span className={styles.otherText}>{props.user?.login || `UserId: ${props.user?.userId}` || 'Unknown'}</span>
    </div>
  );
}

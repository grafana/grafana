import React from 'react';

import { Avatar } from '@grafana/ui';
import { UserDTO } from 'app/types';

import { useQueryLibraryListStyles } from './styles';

type AddedByCellProps = {
  user?: UserDTO;
};
export function AddedByCell(props: AddedByCellProps) {
  const styles = useQueryLibraryListStyles();

  return (
    <div>
      <span className={styles.logo}>
        <Avatar src={props.user?.avatarUrl || 'https://secure.gravatar.com/avatar'} alt="unknown" />
      </span>
      <span className={styles.otherText}>{props.user?.login || 'Unknown'}</span>
    </div>
  );
}

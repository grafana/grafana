import { Avatar } from '@grafana/ui';
import { User } from 'app/features/query-library/types';

import { useQueryLibraryListStyles } from './styles';

type AddedByCellProps = {
  user?: User;
};
export function AddedByCell(props: AddedByCellProps) {
  const styles = useQueryLibraryListStyles();

  return (
    <div>
      <span className={styles.logo}>
        <Avatar src={props.user?.avatarUrl || 'https://secure.gravatar.com/avatar'} alt="unknown" />
      </span>
      <span className={styles.otherText}>{props.user?.displayName || 'Unknown'}</span>
    </div>
  );
}

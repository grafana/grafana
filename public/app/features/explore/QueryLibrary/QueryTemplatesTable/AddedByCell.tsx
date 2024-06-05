import { Avatar } from '@grafana/ui';

import { useQueryLibraryListStyles } from './styles';

export function AddedByCell() {
  const styles = useQueryLibraryListStyles();

  return (
    <div>
      <span className={styles.logo}>
        <Avatar src="https://secure.gravatar.com/avatar" alt="unknown" />
      </span>
      <span className={styles.otherText}>Unknown</span>
    </div>
  );
}

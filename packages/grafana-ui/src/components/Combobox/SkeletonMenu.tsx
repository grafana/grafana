import Skeleton from 'react-loading-skeleton';

import { useStyles2 } from '../../themes';

import { getComboboxStyles } from './getComboboxStyles';

interface SkeletonMenuProps {}

export function SkeletonMenu(props: SkeletonMenuProps) {
  const {} = props;
  const styles = useStyles2(getComboboxStyles);

  return (
    <ul className={styles.menuUlContainer}>
      <li className={styles.skeletonOption}>
        <Skeleton width={100} />
      </li>

      <li className={styles.skeletonOption}>
        <Skeleton width={150} />
      </li>

      <li className={styles.skeletonOption}>
        <Skeleton width={130} />
      </li>
    </ul>
  );
}

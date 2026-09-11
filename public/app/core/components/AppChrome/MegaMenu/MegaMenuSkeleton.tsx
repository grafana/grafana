import { css } from '@emotion/css';
import Skeleton from 'react-loading-skeleton';

import { type GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

// Placeholder row widths shown while the menu's customisation preferences load on first visit.
const SKELETON_ROW_WIDTHS = [180, 140, 200, 160, 120, 190, 150, 170];

/** Placeholder rows rendered inside the nav list while the menu's preferences load. */
export function MegaMenuSkeleton() {
  const styles = useStyles2(getStyles);

  return (
    <>
      {SKELETON_ROW_WIDTHS.map((width, index) => (
        <li key={index} className={styles.skeletonItem}>
          <Skeleton width={width} height={16} />
        </li>
      ))}
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  skeletonItem: css({
    alignItems: 'center',
    display: 'flex',
    height: theme.spacing(4),
    listStyleType: 'none',
    padding: theme.spacing(0, 1, 0, 1),
  }),
});

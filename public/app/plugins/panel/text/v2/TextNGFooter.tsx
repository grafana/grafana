import { css } from '@emotion/css';
import { type ReactNode } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

export const FOOTER_TEST_ID = 'TextNG-footer';

export interface TextNGFooterProps {
  left?: ReactNode;
  center?: ReactNode;
  right?: ReactNode;
}

export function TextNGFooter({ left, center, right }: TextNGFooterProps) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.footer} data-testid={FOOTER_TEST_ID}>
      <div className={styles.left}>{left}</div>
      <div className={styles.center}>{center}</div>
      <div className={styles.right}>{right}</div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  // Grid, not flex: the side tracks are equal, so the centre slot stays on the
  // panel's midline whatever the sides hold. minmax(0, 1fr) lets a long frame
  // name shrink instead of pushing the centre off.
  footer: css({
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)',
    alignItems: 'center',
    gap: theme.spacing(1),
    minHeight: theme.spacing(theme.components.height.md),
  }),
  // The slots fill their tracks and align their content, rather than shrinking to
  // fit it: a slot narrower than its content would overflow into the centre.
  left: css({
    display: 'flex',
    justifyContent: 'flex-start',
    minWidth: 0,
  }),
  center: css({
    display: 'flex',
    justifyContent: 'center',
  }),
  right: css({
    display: 'flex',
    justifyContent: 'flex-end',
  }),
});

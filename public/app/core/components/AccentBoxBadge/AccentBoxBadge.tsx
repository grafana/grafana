import { css } from '@emotion/css';
import { forwardRef } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

export interface Props {
  children: React.ReactNode;
}

export const AccentBoxBadge = forwardRef<HTMLDivElement, Props>(function AccentBoxBadge({ children }, ref) {
  const styles = useStyles2(getStyles);

  return (
    <div ref={ref} className={styles.icon}>
      {children}
    </div>
  );
});

const getStyles = (theme: GrafanaTheme2) => {
  return {
    icon: css({
      color: theme.colors.accent.text,
      backgroundColor: theme.colors.accent.background,
      borderRadius: theme.shape.radius.default,
      padding: theme.spacing(1),
      width: theme.spacing(4.5),
      height: theme.spacing(4.5),
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }),
  };
};

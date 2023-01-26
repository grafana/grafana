import { css } from '@emotion/css';
import React from 'react';

import { Badge, HorizontalGroup, useStyles2 } from '@grafana/ui';

export const AuthBadge = ({ children }: React.PropsWithChildren<{}>) => {
  const styles = useStyles2(getStyles);

  return <Badge color="green" className={styles.badge} text={children} />;
};

const getStyles = (theme: GrafanaTheme2) => ({
  badge: css`
    background-color: ${theme.colors.background.canvas};
    border-color: ${theme.colors.border.strong};
    color: ${theme.colors.text.secondary};
    white-space: nowrap;
  `,
  detailsWrapper: css`
    align-items: center;
    display: flex;
  `,
  strong: css`
    color: ${theme.colors.text.primary};
  `,
  icon: css`
    margin-right: ${theme.spacing(0.5)};
  `,
});

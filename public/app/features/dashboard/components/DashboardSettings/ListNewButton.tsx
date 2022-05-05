import { css } from '@emotion/css';
import React, { ButtonHTMLAttributes } from 'react';

import { GrafanaTheme } from '@grafana/data';
import { Button, useStyles } from '@grafana/ui';

export interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {}

export const ListNewButton: React.FC<Props> = ({ children, ...restProps }) => {
  const styles = useStyles(getStyles);
  return (
    <div className={styles.buttonWrapper}>
      <Button icon="plus" variant="secondary" {...restProps}>
        {children}
      </Button>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme) => ({
  buttonWrapper: css`
    padding: ${theme.spacing.lg} 0;
  `,
});

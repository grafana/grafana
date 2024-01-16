import { css } from '@emotion/css';
import React, { ButtonHTMLAttributes } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, useStyles2 } from '@grafana/ui';

export interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {}

export const ListNewButton = ({ children, ...restProps }: Props) => {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.buttonWrapper}>
      <Button icon="plus" variant="secondary" {...restProps}>
        {children}
      </Button>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  buttonWrapper: css`
    padding: ${theme.spacing(3)} 0;
  `,
});

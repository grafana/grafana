import { css } from '@emotion/css';
import { type ButtonHTMLAttributes } from 'react';

import type { GrafanaTheme2 } from '@grafana/data/themes';
import { Button } from '@grafana/ui';
import { useStyles2 } from '@grafana/ui/themes';

export interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {}

export const ListNewButton = ({ children, ...restProps }: Props) => {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.buttonWrapper}>
      <Button icon="plus" {...restProps}>
        {children}
      </Button>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  buttonWrapper: css({
    padding: `${theme.spacing(3)} 0`,
  }),
});

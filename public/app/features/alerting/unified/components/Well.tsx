import { css, cx } from '@emotion/css';
import * as React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

type Props = React.HTMLAttributes<HTMLDivElement>;

export const Well = ({ children, className }: Props) => {
  const styles = useStyles2(getStyles);
  return <div className={cx(styles.wrapper, className)}>{children}</div>;
};
export const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    backgroundColor: theme.components.panel.background,
    border: `solid 1px ${theme.components.input.borderColor}`,
    borderRadius: theme.shape.radius.default,
    padding: theme.spacing(0.5, 1),
    fontFamily: theme.typography.fontFamilyMonospace,
  }),
});

import { cx, css } from '@emotion/css';
import React, { FC } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

type Props = React.HTMLAttributes<HTMLDivElement>;

export const Well: FC<Props> = ({ children, className }) => {
  const styles = useStyles2(getStyles);
  return <div className={cx(styles.wrapper, className)}>{children}</div>;
};
export const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css`
    background-color: ${theme.components.panel.background};
    border: solid 1px ${theme.components.input.borderColor};
    border-radius: ${theme.shape.borderRadius(1)};
    padding: ${theme.spacing(0.5, 1)};
    font-family: ${theme.typography.fontFamilyMonospace};
  `,
});

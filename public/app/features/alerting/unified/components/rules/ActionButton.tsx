import { css, cx } from '@emotion/css';
import React, { FC } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { Button, ButtonProps } from '@grafana/ui/src/components/Button';

type Props = Omit<ButtonProps, 'variant' | 'size'>;

export const ActionButton: FC<Props> = ({ className, ...restProps }) => {
  const styles = useStyles2(getStyle);
  return <Button variant="secondary" size="xs" className={cx(styles.wrapper, className)} {...restProps} />;
};

export const getStyle = (theme: GrafanaTheme2) => ({
  wrapper: css`
    height: 24px;
    font-size: ${theme.typography.bodySmall.fontSize};
  `,
});

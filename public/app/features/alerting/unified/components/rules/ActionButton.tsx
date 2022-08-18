import { css, cx } from '@emotion/css';
import React, { FC } from 'react';

import { GrafanaTheme } from '@grafana/data';
import { useStyles } from '@grafana/ui';
import { Button, ButtonProps } from '@grafana/ui/src/components/Button';

type Props = Omit<ButtonProps, 'variant' | 'size'>;

export const ActionButton: FC<Props> = ({ className, ...restProps }) => (
  <Button variant="secondary" size="xs" className={cx(useStyles(getStyle), className)} {...restProps} />
);

export const getStyle = (theme: GrafanaTheme) => css`
  height: 24px;
  font-size: ${theme.typography.size.sm};
`;

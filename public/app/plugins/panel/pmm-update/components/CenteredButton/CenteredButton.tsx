import { cx } from '@emotion/css';
import React, { FC } from 'react';

import { Button, ButtonProps } from '@grafana/ui';

import * as styles from './CenteredButton.styles';

export const CenteredButton: FC<ButtonProps> = ({ children, className, ...props }) => (
  <Button className={cx(className, styles.centeredButton)} {...props}>
    {children}
  </Button>
);

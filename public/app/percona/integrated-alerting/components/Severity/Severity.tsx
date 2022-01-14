import { cx } from 'emotion';
import React, { FC } from 'react';

import { useTheme } from '@grafana/ui';

import { getStyles } from './Severity.styles';
import { SeverityProps } from './Severity.types';

export const Severity: FC<SeverityProps> = ({ severity, className }) => {
  const theme = useTheme();
  const styles = getStyles(theme, severity);

  return <span className={cx(styles.severity, className)}>{severity}</span>;
};

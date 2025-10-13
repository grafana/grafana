import { cx } from '@emotion/css';
import { FC } from 'react';

import { useTheme2 } from '@grafana/ui';

import { getStyles } from './Severity.styles';
import { SeverityProps } from './Severity.types';

export const Severity: FC<SeverityProps> = ({ severity, className }) => {
  const theme = useTheme2();
  const styles = getStyles(theme, severity);

  return <span className={cx(styles.severity, className)}>{severity}</span>;
};

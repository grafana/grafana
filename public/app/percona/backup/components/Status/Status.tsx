import React, { FC } from 'react';
import { useTheme } from '@grafana/ui';
import { formatStatus } from '../../Backup.utils';
import { StatusProps } from './Status.types';
import { getStyles } from './Status.styles';

export const Status: FC<StatusProps> = ({ status }) => {
  const statusMsg = formatStatus(status);
  const theme = useTheme();
  const styles = getStyles(theme, status);

  return <span className={styles.status}>{statusMsg}</span>;
};

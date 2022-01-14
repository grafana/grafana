import React, { FC } from 'react';

import { useTheme } from '@grafana/ui';

import { formatStatus } from '../BackupInventory.utils';

import { getStyles } from './Status.styles';
import { StatusProps } from './Status.types';

export const Status: FC<StatusProps> = ({ status }) => {
  const statusMsg = formatStatus(status);
  const theme = useTheme();
  const styles = getStyles(theme, status);

  return <span className={styles.status}>{statusMsg}</span>;
};

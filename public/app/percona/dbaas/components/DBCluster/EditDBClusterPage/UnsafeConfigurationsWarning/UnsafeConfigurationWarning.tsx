import React, { FC } from 'react';

import { Alert, useStyles } from '@grafana/ui/src';

import { getStyles } from './UnsafeConfigurationWarning.styles';

export const UnsafeConfigurationWarning: FC = () => {
  const styles = useStyles(getStyles);

  return (
    <Alert title="" className={styles.alertMessageWrapper} severity="info" data-testid="pmm-server-url-warning">
      Unsafe configuration, not for production use
    </Alert>
  );
};

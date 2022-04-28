import React, { FC } from 'react';
import { useStyles2 } from '@grafana/ui';
import { Diagnostics } from '..';
import { getStyles } from './WithDiagnostics.styles';

export const WithDiagnostics: FC = ({ children }) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.container}>
      <Diagnostics />
      {children}
    </div>
  );
};

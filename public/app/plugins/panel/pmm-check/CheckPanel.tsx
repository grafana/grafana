import React, { FC } from 'react';

import { useStyles2 } from '@grafana/ui';

import { getStyles } from './CheckPanel.styles';
import { Failed } from './components';

export const CheckPanel: FC = () => {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.panel} data-testid="db-check-panel-home">
      <Failed />
    </div>
  );
};

import { FC } from 'react';

import { PanelProps } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { getStyles } from './CheckPanel.styles';
import { Failed } from './components';

export const CheckPanel: FC<PanelProps> = (props) => {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.panel} data-testid="db-check-panel-home">
      <Failed {...props} />
    </div>
  );
};

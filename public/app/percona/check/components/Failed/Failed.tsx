import React, { FC } from 'react';

import { Icon, Tooltip } from '@grafana/ui';
import { FailedChecks } from 'app/percona/check/types';

import * as styles from './Failed.styles';
import { TooltipText } from './TooltipText';

interface FailedProps {
  failed: FailedChecks;
}

export const Failed: FC<FailedProps> = ({ failed }) => {
  const sum = failed.reduce((acc, val) => acc + val, 0);

  return (
    <div>
      <span className={styles.FailedDiv}>
        {sum} ({failed.join(' / ')})
      </span>
      <Tooltip placement="top" theme="info" content={<TooltipText sum={sum} data={failed} />}>
        <span>
          <Icon name="info-circle" className={styles.InfoIcon} />
        </span>
      </Tooltip>
    </div>
  );
};

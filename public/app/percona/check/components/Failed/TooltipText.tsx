import React, { FC } from 'react';
import { FailedChecks } from 'app/percona/check/types';
import * as styles from './Failed.styles';

interface TooltipTextProps {
  sum: number;
  data: FailedChecks;
}

export const TooltipText: FC<TooltipTextProps> = ({ sum, data }) => {
  if (!sum) {
    return null;
  }

  const [critical, major, trivial] = data;

  return (
    <div className={styles.TooltipWrapper}>
      <div className={styles.TooltipHeader}>Failed checks: {sum}</div>
      <div className={styles.TooltipBody}>
        <div>Critical &ndash; {critical}</div>
        <div>Major &ndash; {major}</div>
        <div>Trivial &ndash; {trivial}</div>
      </div>
    </div>
  );
};

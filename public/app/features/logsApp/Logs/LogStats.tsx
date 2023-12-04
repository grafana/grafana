import React from 'react';

import { LogRowModel } from '@grafana/data';
import { LogRowStyles } from 'app/features/logs/components/getLogRowStyles';

export interface Props  {
  rows: LogRowModel[];
  styles: LogRowStyles;
}

export const LogStats = ({ styles }: Props) => {
  return (
    <div className={styles.logDetails}>
      <div className={styles.logDetailsContainer}>
        Stats
      </div>
    </div>
  );
}
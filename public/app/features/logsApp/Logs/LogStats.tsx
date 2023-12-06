import React from 'react';

import {
  FieldType,
  Labels,
  LogRowModel,
  LogsMetaItem,
  createDataFrame,
  getDefaultTimeRange,
  LoadingState,
} from '@grafana/data';
import { PanelRenderer } from '@grafana/runtime';
import { LogLabelStats } from 'app/features/logs/components/LogLabelStats';
import { LogRowStyles } from 'app/features/logs/components/getLogRowStyles';
import { COMMON_LABELS, UNIQUE_LABELS } from 'app/features/logs/logsModel';
import { calculateLogsLabelStats } from 'app/features/logs/utils';
// import { LogLabelStats } from 'app/features/logs/components/LogLabelStats';

export interface Props {
  rows: LogRowModel[];
  styles: LogRowStyles;
  logsMeta: LogsMetaItem[] | undefined;
}

export const LogStats = ({ styles, rows, logsMeta }: Props) => {
  const commonLabels = logsMeta?.find((meta) => meta.label === COMMON_LABELS)?.value ?? ({} as Labels);
  const uniqueLabel = logsMeta?.find((meta) => meta.label === UNIQUE_LABELS)?.value ?? ({} as Labels);
  console.log('common labels', commonLabels);
  console.log('unique labels', uniqueLabel);

  // updateStats = () => {
  //   const { getStats } = this.props;
  //   const fieldStats = getStats();
  //   const fieldCount = fieldStats ? fieldStats.reduce((sum, stat) => sum + stat.count, 0) : 0;
  //   if (!isEqual(this.state.fieldStats, fieldStats) || fieldCount !== this.state.fieldCount) {
  //     this.setState({ fieldStats, fieldCount });
  //   }
  // };

  return (
    <div className={styles.logDetails}>
      <div style={{ fontWeight: 'bold', color: 'orange' }}>Common labels</div>
      {commonLabels &&
        Object.keys(commonLabels).map((key) => {
          return (
            <div key={key} style={{ margin: '8px 0' }}>
              <div>{key}</div>
              {/*@ts-ignore*/}
              {rows.length}/{rows.length} 100% {commonLabels[key]} + -
            </div>
          );
        })}
      <div style={{ fontWeight: 'bold', color: 'orange' }}>Unique labels</div>
      <div>
        {uniqueLabel &&
          Object.keys(uniqueLabel).map((key) => {
            const stats = calculateLogsLabelStats(rows, key);
            return (
              <div>
                <LogLabelStats stats={stats} label={key} value={''} rowCount={rows.length} />
              </div>
            );
          })}
      </div>
    </div>
  );
};

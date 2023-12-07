import React from 'react';

import { Labels, LogRowModel, LogsMetaItem } from '@grafana/data';
import { Icon, Button } from '@grafana/ui';
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

  return (
    <div className={styles.logDetails}>
      <div className={styles.logDetailsContainer}>
        <div
          style={{ fontFamily: "'Roboto Mono', monospace", fontSize: '12px', padding: '12px' }}
          className={styles.logDetailsTable}
        >
          <div style={{ fontWeight: 500, fontSize: '14px', marginBottom: '8px' }}>Log results ad hoc statistics</div>
          <Button style={{ margin: '4px 0 8px 0' }} size="sm" variant="secondary" icon="ai">
            Help me understand my log lines
            <Icon name={`${false ? 'angle-up' : 'angle-down'}`} />
          </Button>
          {uniqueLabel && (
            <>
              <div>
                {Object.keys(uniqueLabel).map((key) => {
                  const stats = calculateLogsLabelStats(rows, key);
                  return (
                    <div key={key}>
                      <LogLabelStats stats={stats} label={key} value={''} rowCount={rows.length} shouldFilter={true} />
                    </div>
                  );
                })}
              </div>
            </>
          )}
          {commonLabels &&
            Object.keys(commonLabels as Labels).map((key) => {
              return (
                <div key={key}>
                  <LogLabelStats
                    stats={[{ count: rows.length, proportion: 1, value: commonLabels[key] }]}
                    label={key}
                    value={''}
                    rowCount={rows.length}
                    shouldFilter={true}
                  />
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
};

import React from 'react';

import { DataFrame, Labels, LogRowModel, LogsMetaItem } from '@grafana/data';
import { Icon, Button } from '@grafana/ui';
import { LogLabelStats } from 'app/features/logs/components/LogLabelStats';
import { LogRowStyles } from 'app/features/logs/components/getLogRowStyles';
import { COMMON_LABELS, UNIQUE_LABELS } from 'app/features/logs/logsModel';
import { calculateLogsLabelStats } from 'app/features/logs/utils';

export interface Props {
  rows: LogRowModel[];
  styles: LogRowStyles;
  logsMeta: LogsMetaItem[] | undefined;
  onClickFilterLabel?: (key: string, value: string, frame?: DataFrame) => void;
  onClickFilterOutLabel?: (key: string, value: string, frame?: DataFrame) => void;
}

export const LogStats = ({ styles, rows, logsMeta, onClickFilterLabel, onClickFilterOutLabel }: Props) => {
  //@ts-ignore
  const commonLabels: Labels = logsMeta?.find((meta) => meta.label === COMMON_LABELS)?.value ?? ({} as Labels);
  //@ts-ignore
  const uniqueLabel: Labels = logsMeta?.find((meta) => meta.label === UNIQUE_LABELS)?.value ?? ({} as Labels);

  return (
    <div className={styles.logDetails}>
      <div className={styles.logDetailsContainer}>
        <div style={{ fontFamily: "'Roboto Mono', monospace", fontSize: '12px', padding: '8px 0' }}>
          <div style={{ fontWeight: 500, fontSize: '12px', marginBottom: '8px' }}>Log results ad hoc statistics</div>
          <Button style={{ margin: '4px 0 8px 0' }} size="sm" variant="secondary" icon="ai">
            Help me understand my log lines
            <Icon name={`${false ? 'angle-up' : 'angle-down'}`} />
          </Button>
          {/**todo angles are not working yet */}
          {uniqueLabel && (
            <>
              <div style={{ fontSize: '12px', marginTop: '8px' }}>
                Unique fields
                <Icon name="angle-down" />
              </div>
              <div>
                {Object.keys(uniqueLabel).map((key) => {
                  const stats = calculateLogsLabelStats(rows, key);
                  return (
                    <div key={key}>
                      <LogLabelStats
                        stats={stats}
                        label={key}
                        value={''}
                        rowCount={rows.length}
                        shouldFilter={true}
                        onClickFilterOutLabel={onClickFilterOutLabel}
                        onClickFilterLabel={onClickFilterLabel}
                      />
                    </div>
                  );
                })}
              </div>
            </>
          )}
          {commonLabels && (
            <>
              <div style={{ fontSize: '12px', marginTop: '8px' }}>
                Common fields
                <Icon name="angle-down" />
              </div>
              {Object.keys(commonLabels as Labels).map((key: string) => {
                return (
                  <div key={key}>
                    <LogLabelStats
                      stats={[{ count: rows.length, proportion: 1, value: commonLabels[key] as string }]}
                      label={key}
                      value={''}
                      rowCount={rows.length}
                      shouldFilter={true}
                      onClickFilterLabel={onClickFilterLabel}
                      onClickFilterOutLabel={onClickFilterOutLabel}
                    />
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

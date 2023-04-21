import { css } from '@emotion/css';
import { formatDistanceToNowStrict } from 'date-fns';
import { groupBy, uniqueId } from 'lodash';
import React from 'react';

import { dateTimeFormat, GrafanaTheme2 } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { Icon, TagList, useStyles2 } from '@grafana/ui';

import { Label } from '../../Label';
import { AlertStateTag } from '../AlertStateTag';

import { LogRecord, omitLabels } from './common';

interface LogRecordViewerProps {
  records: LogRecord[];
  commonLabels: Array<[string, string]>;
  logsRef: React.MutableRefObject<Map<number, HTMLElement>>;
  onLabelClick?: (label: string) => void;
}

export const LogRecordViewerByTimestamp = React.memo(
  ({ records, commonLabels, logsRef, onLabelClick }: LogRecordViewerProps) => {
    const styles = useStyles2(getStyles);

    // groupBy has been replaced by the reduce to avoid back and forth conversion of timestamp from number to string
    // Looks like it improved performance significantly
    const groupedLines = records.reduce((acc, current) => {
      const tsGroup = acc.get(current.timestamp);
      if (tsGroup) {
        tsGroup.push(current);
      }
      acc.set(current.timestamp, [current]);

      return acc;
    }, new Map<number, LogRecord[]>());

    logsRef.current.clear();

    return (
      <ul className={styles.logsScrollable} aria-label="State history by timestamp">
        {Array.from(groupedLines.entries()).map(([key, records]) => {
          return (
            <li id={key.toString(10)} key={key} ref={(element) => element && logsRef.current.set(key, element)}>
              <Timestamp time={key} />
              <div className={styles.logsContainer}>
                {records.map(({ line }) => (
                  <React.Fragment key={uniqueId()}>
                    <AlertStateTag state={line.previous} size="sm" muted />
                    <Icon name="arrow-right" size="sm" />
                    <AlertStateTag state={line.current} />
                    <Stack direction="row">{line.values && <AlertInstanceValues record={line.values} />}</Stack>
                    <div>
                      {line.labels && (
                        <TagList
                          tags={omitLabels(Object.entries(line.labels), commonLabels).map(
                            ([key, value]) => `${key}=${value}`
                          )}
                          onClick={onLabelClick}
                        />
                      )}
                    </div>
                  </React.Fragment>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
    );
  }
);
LogRecordViewerByTimestamp.displayName = 'LogRecordViewerByTimestamp';

export function LogRecordViewerByInstance({ records, commonLabels, logsRef }: LogRecordViewerProps) {
  const styles = useStyles2(getStyles);

  const groupedLines = groupBy(records, (record: LogRecord) => {
    return JSON.stringify(record.line.labels);
  });

  return (
    <>
      {Object.entries(groupedLines).map(([key, records]) => {
        return (
          <Stack direction="column" key={key}>
            <h4>
              <TagList
                tags={omitLabels(Object.entries(records[0].line.labels ?? {}), commonLabels).map(
                  ([key, value]) => `${key}=${value}`
                )}
              />
            </h4>
            <div className={styles.logsContainer}>
              {records.map(({ line, timestamp }) => (
                <div key={uniqueId()} ref={(ref) => ref && logsRef.current.set(timestamp, ref)}>
                  <AlertStateTag state={line.previous} size="sm" muted />
                  <Icon name="arrow-right" size="sm" />
                  <AlertStateTag state={line.current} />
                  <Stack direction="row">{line.values && <AlertInstanceValues record={line.values} />}</Stack>
                  <div>{dateTimeFormat(timestamp)}</div>
                </div>
              ))}
            </div>
          </Stack>
        );
      })}
    </>
  );
}

interface TimestampProps {
  time: number; // epoch timestamp
}

const Timestamp = ({ time }: TimestampProps) => {
  const dateTime = new Date(time);
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.timestampWrapper}>
      <Stack direction="row" alignItems="center" gap={1}>
        <Icon name="clock-nine" size="sm" />
        <span className={styles.timestampText}>{dateTimeFormat(dateTime)}</span>
        <small>({formatDistanceToNowStrict(dateTime)} ago)</small>
      </Stack>
    </div>
  );
};

const AlertInstanceValues = React.memo(({ record }: { record: Record<string, number> }) => {
  const values = Object.entries(record);

  return (
    <>
      {values.map(([key, value]) => (
        <Label key={key} label={key} value={value} />
      ))}
    </>
  );
});
AlertInstanceValues.displayName = 'AlertInstanceValues';

const getStyles = (theme: GrafanaTheme2) => ({
  logsContainer: css`
    display: grid;
    grid-template-columns: max-content max-content max-content auto max-content;
    gap: ${theme.spacing(2, 1)};
    align-items: center;
  `,
  logsScrollable: css`
    height: 500px;
    overflow: scroll;

    flex: 1;
  `,
  timestampWrapper: css`
    color: ${theme.colors.text.secondary};
    padding: ${theme.spacing(1)} 0;
  `,
  timestampText: css`
    color: ${theme.colors.text.primary};
    font-size: ${theme.typography.bodySmall.fontSize};
    font-weight: ${theme.typography.fontWeightBold};
  `,
});

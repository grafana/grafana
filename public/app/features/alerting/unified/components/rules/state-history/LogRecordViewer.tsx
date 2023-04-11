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
  logsRef: React.MutableRefObject<HTMLDivElement[]>;
  onLabelClick?: (label: string) => void;
}

export function LogRecordViewerByTimestamp({ records, commonLabels, logsRef, onLabelClick }: LogRecordViewerProps) {
  const styles = useStyles2(getStyles);

  const groupedLines = groupBy(records, (record: LogRecord) => record.timestamp);

  return (
    <div className={styles.logsScrollable}>
      {Object.entries(groupedLines).map(([key, records]) => {
        return (
          <div id={key} key={key} ref={(element) => element && logsRef.current.push(element)}>
            <div>
              <Timestamp time={parseInt(key, 10)} />
              <div className={styles.logsContainer}>
                {records.map((logRecord) => (
                  <React.Fragment key={uniqueId()}>
                    <AlertStateTag state={logRecord.line.previous} size="sm" muted />
                    <Icon name="arrow-right" />
                    <AlertStateTag state={logRecord.line.current} />
                    <Stack direction="row">
                      <AlertInstanceValues record={logRecord.line.values} />
                    </Stack>
                    <div>
                      <TagList
                        tags={omitLabels(Object.entries(logRecord.line.labels), commonLabels).map(
                          ([key, value]) => `${key}=${value}`
                        )}
                        onClick={onLabelClick}
                      />
                    </div>
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

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
                tags={omitLabels(Object.entries(records[0].line.labels), commonLabels).map(
                  ([key, value]) => `${key}=${value}`
                )}
              />
            </h4>
            <div className={styles.logsContainer}>
              {records.map((logRecord) => (
                <div key={uniqueId()} ref={(ref) => ref && logsRef.current.push(ref)}>
                  <AlertStateTag state={logRecord.line.previous} size="sm" muted />
                  <Icon name="arrow-right" />
                  <AlertStateTag state={logRecord.line.current} />
                  <Stack direction="row">
                    <AlertInstanceValues record={logRecord.line.values} />
                  </Stack>
                  <div>{dateTimeFormat(logRecord.timestamp)}</div>
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
        <Icon name="clock-nine" />
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
    padding: ${theme.spacing(2)} 0;
  `,
  timestampText: css`
    color: ${theme.colors.text.primary};
    font-weight: ${theme.typography.fontWeightBold};
  `,
});

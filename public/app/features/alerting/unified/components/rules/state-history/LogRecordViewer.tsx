import { css } from '@emotion/css';
import { formatDistanceToNowStrict } from 'date-fns';
import { groupBy, uniqueId } from 'lodash';
import { Fragment, memo, useEffect } from 'react';

import { GrafanaTheme2, dateTimeFormat } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Box, Icon, Stack, TagList, Text, useStyles2 } from '@grafana/ui';

import { Label } from '../../Label';
import { AlertStateTag } from '../AlertStateTag';

import { LogRecord, omitLabels } from './common';
import { GrafanaAlertState, mapStateWithReasonToBaseState } from 'app/types/unified-alerting-dto';

type LogRecordViewerProps = {
  records: LogRecord[];
  commonLabels: Array<[string, string]>;
};

type AdditionalLogRecordViewerProps = {
  onRecordsRendered?: (timestampRefs: Map<number, HTMLElement>) => void;
  onLabelClick?: (label: string) => void;
};

function groupRecordsByTimestamp(records: LogRecord[]) {
  // groupBy has been replaced by the reduce to avoid back and forth conversion of timestamp from number to string
  const groupedLines = records.reduce((acc, current) => {
    const tsGroup = acc.get(current.timestamp);
    if (tsGroup) {
      tsGroup.push(current);
    } else {
      acc.set(current.timestamp, [current]);
    }

    return acc;
  }, new Map<number, LogRecord[]>());

  return new Map([...groupedLines].sort((a, b) => b[0] - a[0]));
}

export const LogRecordViewerByTimestamp = memo(
  ({
    records,
    commonLabels,
    onLabelClick,
    onRecordsRendered,
  }: LogRecordViewerProps & AdditionalLogRecordViewerProps) => {
    const styles = useStyles2(getStyles);

    const groupedLines = groupRecordsByTimestamp(records);

    const timestampRefs = new Map<number, HTMLElement>();
    useEffect(() => {
      onRecordsRendered && onRecordsRendered(timestampRefs);
    });

    return (
      <ul
        className={styles.logsScrollable}
        aria-label={t(
          'alerting.log-record-viewer-by-timestamp.aria-label-state-history-by-timestamp',
          'State history by timestamp'
        )}
      >
        {Array.from(groupedLines.entries()).map(([key, records]) => {
          return (
            <li
              id={key.toString(10)}
              key={key}
              data-testid={key}
              ref={(element) => element && timestampRefs.set(key, element)}
              className={styles.listItemWrapper}
            >
              <Timestamp time={key} />
              {records.map(({ line }, idx) => {
                const id = line.fingerprint ?? `${key}-${idx}`;
                return (
                  <Fragment key={id}>
                    <div className={styles.logsContainer}>
                      <AlertStateTag state={line.previous} size="sm" muted />
                      <Icon name="arrow-right" size="sm" />
                      <AlertStateTag state={line.current} />
                      <Stack>{line.values && <AlertInstanceValues record={line.values} />}</Stack>
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
                    </div>
                    {mapStateWithReasonToBaseState(line.current) === GrafanaAlertState.Error &&
                      (line as any)?.error && (
                        <div className={styles.errorRow} data-testid="state-history-error">
                          <Box
                            display="flex"
                            borderStyle="solid"
                            borderColor="error"
                            backgroundColor="error"
                            paddingY={1}
                            paddingX={2}
                            borderRadius="default"
                          >
                            <Text variant="bodySmall">
                              <strong>{t('alerting.state-history.error-message-prefix', 'Error message:')}</strong>{' '}
                              {(line as any).error}
                            </Text>
                          </Box>
                        </div>
                      )}
                  </Fragment>
                );
              })}
            </li>
          );
        })}
      </ul>
    );
  }
);
LogRecordViewerByTimestamp.displayName = 'LogRecordViewerByTimestamp';

export function LogRecordViewerByInstance({ records, commonLabels }: LogRecordViewerProps) {
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
                <div key={uniqueId()}>
                  <AlertStateTag state={line.previous} size="sm" muted />
                  <Icon name="arrow-right" size="sm" />
                  <AlertStateTag state={line.current} />
                  <Stack>{line.values && <AlertInstanceValues record={line.values} />}</Stack>
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
      <Stack alignItems="center" gap={1}>
        <Icon name="clock-nine" size="sm" />
        <span className={styles.timestampText}>{dateTimeFormat(dateTime)}</span>
        <small>
          <Trans i18nKey="alerting.timestamp.time-ago" values={{ time: formatDistanceToNowStrict(dateTime) }}>
            ({'{{time}}'} ago)
          </Trans>
        </small>
      </Stack>
    </div>
  );
};

const AlertInstanceValues = memo(({ record }: { record: Record<string, number> }) => {
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
  logsContainer: css({
    display: 'grid',
    gridTemplateColumns: 'max-content max-content max-content auto max-content',
    gap: theme.spacing(2, 1),
    alignItems: 'center',
  }),
  errorRow: css({
    color: theme.colors.text.secondary,
    marginTop: theme.spacing(0.5),
    display: 'block',
  }),
  errorBox: css({
    display: 'contents',
  }),
  logsScrollable: css({
    height: '500px',
    overflow: 'scroll',

    flex: 1,
  }),
  timestampWrapper: css({
    color: theme.colors.text.secondary,
  }),
  timestampText: css({
    color: theme.colors.text.primary,
    fontSize: theme.typography.bodySmall.fontSize,
    fontWeight: theme.typography.fontWeightBold,
  }),
  listItemWrapper: css({
    background: 'transparent',
    outline: '1px solid transparent',
    padding: `${theme.spacing(1)} ${theme.spacing(1.5)}`,
    [theme.transitions.handleMotion('no-preference', 'reduce')]: {
      transition: 'background 150ms, outline 150ms',
    },
  }),
});

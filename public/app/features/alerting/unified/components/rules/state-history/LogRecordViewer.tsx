import { css } from '@emotion/css';
import { formatDistanceToNowStrict } from 'date-fns';
import { groupBy, uniqueId } from 'lodash';
import { Fragment, memo, useEffect, useRef, useState } from 'react';

import { GrafanaTheme2, dateTimeFormat } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Box, Icon, Stack, TagList, Text, useStyles2 } from '@grafana/ui';
import { GrafanaAlertState, mapStateWithReasonToBaseState } from 'app/types/unified-alerting-dto';

import { Label } from '../../Label';
import { AlertStateTag } from '../AlertStateTag';

import { LogRecord, omitLabels } from './common';

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

    const [expandedErrorIds, setExpandedErrorIds] = useState<Record<string, boolean>>({});
    const [isTruncatedById, setIsTruncatedById] = useState<Record<string, boolean>>({});
    const errorMessageRefs = useRef<Map<string, HTMLElement>>(new Map());

    const timestampRefs = useRef<Map<number, HTMLElement>>(new Map());
    useEffect(() => {
      onRecordsRendered && onRecordsRendered(timestampRefs.current);
    }, [onRecordsRendered, records]);

    // Re-measure truncation on resize
    useEffect(() => {
      const handleResize = () => {
        const updates: Record<string, boolean> = {};
        errorMessageRefs.current.forEach((el, id) => {
          const truncated = el.scrollWidth > el.clientWidth;
          updates[id] = truncated;
        });
        if (Object.keys(updates).length) {
          setIsTruncatedById((prev) => ({ ...prev, ...updates }));
        }
      };
      window.addEventListener('resize', handleResize);
      // initial measure
      handleResize();
      return () => window.removeEventListener('resize', handleResize);
    }, []);

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
              ref={(element) => {
                if (element) {
                  timestampRefs.current.set(key, element);
                } else {
                  timestampRefs.current.delete(key);
                }
              }}
              className={styles.listItemWrapper}
            >
              <Timestamp time={key} />
              {records.map(({ line }, idx) => {
                const id = line.fingerprint ?? `${key}-${idx}`;
                const errorText = line.error ?? '';
                const isMultiline = errorText.includes('\n');
                const isTruncated = Boolean(isTruncatedById[id]);
                const isExpanded = Boolean(expandedErrorIds[id]);
                const shouldShowToggle = isMultiline || isTruncated || isExpanded;
                const isErrorRow =
                  mapStateWithReasonToBaseState(line.current) === GrafanaAlertState.Error && Boolean(line.error);
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
                    {isErrorRow && (
                      <div className={styles.errorRow} data-testid="state-history-error">
                        <Box
                          display="flex"
                          borderStyle="solid"
                          borderColor="info"
                          backgroundColor="info"
                          paddingY={1}
                          paddingX={2}
                          borderRadius="default"
                        >
                          <div
                            className={isExpanded ? styles.errorMessageExpanded : styles.errorMessageCollapsed}
                            ref={(el) => {
                              if (el) {
                                errorMessageRefs.current.set(id, el);
                                const truncated = el.scrollWidth > el.clientWidth;
                                setIsTruncatedById((prev) =>
                                  prev[id] === truncated ? prev : { ...prev, [id]: truncated }
                                );
                              } else {
                                errorMessageRefs.current.delete(id);
                              }
                            }}
                          >
                            <Text variant="bodySmall">
                              <strong>{t('alerting.state-history.error-message-prefix', 'Error message:')}</strong>{' '}
                              {isExpanded ? errorText : (errorText.split('\n')[0] ?? '')}
                            </Text>
                          </div>
                          {shouldShowToggle && (
                            <div className={styles.errorToggleWrapper}>
                              <button
                                className={styles.errorToggleButton}
                                onClick={() => setExpandedErrorIds((prev) => ({ ...prev, [id]: !prev[id] }))}
                                aria-label={isExpanded ? t('show-less', 'Show less') : t('show-more', 'Show more')}
                                aria-expanded={isExpanded}
                                type="button"
                              >
                                {isExpanded ? t('show-less', 'Show less') : t('show-more', 'Show more')}
                              </button>
                            </div>
                          )}
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
  errorMessageCollapsed: css({
    // default wrapping for single-line
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '100%',
    minWidth: 0,
    flexGrow: 1,
  }),
  errorMessageExpanded: css({
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    minWidth: 0,
    flexGrow: 1,
  }),
  errorToggleWrapper: css({
    marginLeft: 'auto',
    alignSelf: 'flex-start',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  }),
  errorToggleButton: css({
    background: 'transparent',
    border: 0,
    padding: 0,
    margin: 0,
    color: theme.colors.text.link,
    cursor: 'pointer',
    ...theme.typography.bodySmall,
    whiteSpace: 'nowrap',
    display: 'inline-flex',
    '&:hover': {
      textDecoration: 'underline',
    },
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

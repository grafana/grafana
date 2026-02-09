import {
  CSSProperties,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  MouseEvent,
  useLayoutEffect,
} from 'react';
import Highlighter from 'react-highlight-words';

import { findHighlightChunksInText, LogsDedupStrategy, TimeRange } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, Icon, Tooltip } from '@grafana/ui';

import { LOG_LINE_BODY_FIELD_NAME } from '../LogDetailsBody';
import { LogLabels } from '../LogLabels';
import { LogMessageAnsi } from '../LogMessageAnsi';
import { OTEL_LOG_LINE_ATTRIBUTES_FIELD_NAME } from '../otel/formats';

import { HighlightedLogRenderer } from './HighlightedLogRenderer';
import { useLogDetailsContext } from './LogDetailsContext';
import { InlineLogLineDetails } from './LogLineDetails';
import { LogLineMenu } from './LogLineMenu';
import { useLogIsPermalinked, useLogIsPinned, useLogListContext } from './LogListContext';
import { useLogListSearchContext } from './LogListSearchContext';
import { getNormalizedFieldName, LogListModel } from './processing';
import { LogLineStyles } from './styles';
import { getLogLineDOMHeight, LogFieldDimension, LogLineVirtualization } from './virtualization';

export interface Props {
  displayedFields: string[];
  index: number;
  log: LogListModel;
  logs: LogListModel[];
  showTime: boolean;
  style: CSSProperties;
  styles: LogLineStyles;
  timeRange: TimeRange;
  timeZone: string;
  onClick: (e: MouseEvent<HTMLElement>, log: LogListModel) => void;
  onOverflow?: (index: number, id: string, height?: number) => void;
  variant?: 'infinite-scroll';
  virtualization?: LogLineVirtualization;
  wrapLogMessage: boolean;
}

export const LogLine = ({
  displayedFields,
  index,
  log,
  logs,
  style,
  styles,
  onClick,
  onOverflow,
  showTime,
  timeRange,
  timeZone,
  variant,
  virtualization,
  wrapLogMessage,
}: Props) => {
  return (
    <div style={wrapLogMessage ? style : { ...style, width: 'max-content', minWidth: '100%' }}>
      <LogLineComponent
        displayedFields={displayedFields}
        height={style.height}
        index={index}
        log={log}
        logs={logs}
        styles={styles}
        onClick={onClick}
        onOverflow={onOverflow}
        showTime={showTime}
        timeRange={timeRange}
        timeZone={timeZone}
        variant={variant}
        virtualization={virtualization}
        wrapLogMessage={wrapLogMessage}
      />
    </div>
  );
};

interface LogLineComponentProps extends Omit<Props, 'style'> {
  height?: number | string;
}

const LogLineComponent = memo(
  ({
    displayedFields,
    height,
    index,
    log,
    logs,
    styles,
    onClick,
    onOverflow,
    showTime,
    timeRange,
    timeZone,
    variant,
    virtualization,
    wrapLogMessage,
  }: LogLineComponentProps) => {
    const {
      dedupStrategy,
      fontSize,
      hasLogsWithErrors,
      hasSampledLogs,
      showUniqueLabels,
      timestampResolution,
      onLogLineHover,
    } = useLogListContext();
    const { currentLog, detailsDisplayed, detailsMode, enableLogDetails } = useLogDetailsContext();
    const [collapsed, setCollapsed] = useState<boolean | undefined>(
      wrapLogMessage && log.collapsed !== undefined ? log.collapsed : undefined
    );
    const logLineRef = useRef<HTMLDivElement | null>(null);
    const pinned = useLogIsPinned(log);
    const permalinked = useLogIsPermalinked(log);

    const handleLogLineResize = useCallback(() => {
      if (!onOverflow || !logLineRef.current || !virtualization || !height) {
        return;
      }
      const calculatedHeight = typeof height === 'number' ? height : undefined;
      const actualHeight = getLogLineDOMHeight(virtualization, logLineRef.current, calculatedHeight, log.collapsed);
      if (actualHeight) {
        onOverflow(index, log.uid, actualHeight);
      }
    }, [height, index, log.collapsed, log.uid, onOverflow, virtualization]);

    useLayoutEffect(() => {
      handleLogLineResize();
    }, [handleLogLineResize, detailsMode]);

    useLayoutEffect(() => {
      if (!logLineRef.current) {
        return;
      }
      let frameId: number;
      const handleResize = () => {
        if (frameId) {
          cancelAnimationFrame(frameId);
        }
        frameId = requestAnimationFrame(() => handleLogLineResize());
      };
      const observer = new ResizeObserver(handleResize);
      observer.observe(logLineRef.current);
      return () => {
        observer.disconnect();
        if (frameId) {
          cancelAnimationFrame(frameId);
        }
      };
    }, [handleLogLineResize]);

    useEffect(() => {
      if (!wrapLogMessage) {
        setCollapsed(undefined);
      } else if (collapsed === undefined && log.collapsed !== undefined) {
        setCollapsed(log.collapsed);
      } else if (collapsed !== undefined && log.collapsed === undefined) {
        setCollapsed(log.collapsed);
      }
    }, [collapsed, log.collapsed, wrapLogMessage]);

    const handleMouseOver = useCallback(() => onLogLineHover?.(log), [log, onLogLineHover]);

    const handleExpandCollapse = useCallback(() => {
      const newState = !collapsed;
      log.setCollapsedState(newState);
      setCollapsed(newState);
      onOverflow?.(index, log.uid);
    }, [collapsed, index, log, onOverflow]);

    const handleClick = useCallback(
      (e: MouseEvent<HTMLElement>) => {
        if (isLogLineClick(e.target)) {
          onClick(e, log);
        }
      },
      [log, onClick]
    );

    const isLogDetailsFocused = currentLog?.uid === log.uid;
    const detailsShown = detailsDisplayed(log);

    return (
      <>
        {/* A button element could be used but in Safari it prevents text selection. Fallback available for a11y in LogLineMenu  */}
        {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
        <div
          className={`${styles.logLine} ${variant ?? ''} ${pinned ? styles.pinnedLogLine : ''} ${permalinked ? styles.permalinkedLogLine : ''} ${detailsShown ? styles.detailsDisplayed : ''} ${isLogDetailsFocused ? styles.currentLog : ''} ${fontSize === 'small' ? styles.fontSizeSmall : styles.fontSizeDefault} ${enableLogDetails ? styles.clickable : ''}`}
          ref={onOverflow ? logLineRef : undefined}
          onMouseEnter={handleMouseOver}
          onFocus={handleMouseOver}
          onClick={handleClick}
        >
          <LogLineMenu styles={styles} log={log} active={isLogDetailsFocused} />
          {dedupStrategy !== LogsDedupStrategy.none && (
            <div className={`${styles.duplicates}`}>
              {log.duplicates && log.duplicates > 0 ? `${log.duplicates + 1}x` : null}
            </div>
          )}
          {hasLogsWithErrors && (
            <div className={`${styles.hasError}`}>
              {log.hasError && (
                <Tooltip
                  content={t('logs.log-line.tooltip-error', 'Error: {{errorMessage}}', {
                    errorMessage: log.errorMessage,
                  })}
                  placement="right"
                  theme="error"
                >
                  <Icon
                    className={styles.logIconError}
                    name="exclamation-triangle"
                    aria-label={t('logs.log-line.has-error', 'Has errors')}
                    size="xs"
                  />
                </Tooltip>
              )}
            </div>
          )}
          {hasSampledLogs && (
            <div className={`${styles.isSampled}`}>
              {log.isSampled && (
                <Tooltip content={log.sampledMessage ?? ''} placement="right" theme="info">
                  <Icon
                    className={styles.logIconInfo}
                    name="info-circle"
                    size="xs"
                    aria-label={t('logs.log-line.is-sampled', 'Is sampled')}
                  />
                </Tooltip>
              )}
            </div>
          )}
          <div
            className={`${styles.fieldsWrapper} ${detailsShown ? styles.detailsDisplayed : ''} ${isLogDetailsFocused ? styles.currentLog : ''} ${wrapLogMessage ? styles.wrappedLogLine : `${styles.unwrappedLogLine} unwrapped-log-line`} ${collapsed === true ? styles.collapsedLogLine : ''}`}
            style={
              collapsed && virtualization
                ? { maxHeight: `${virtualization.getTruncationLineCount() * virtualization.getLineHeight()}px` }
                : undefined
            }
          >
            <Log
              collapsed={collapsed}
              displayedFields={displayedFields}
              log={log}
              showTime={showTime}
              showUniqueLabels={showUniqueLabels}
              styles={styles}
              timestampResolution={timestampResolution}
              wrapLogMessage={wrapLogMessage}
            />
          </div>
        </div>
        {collapsed === true && (
          <div className={styles.expandCollapseControl}>
            <Button
              variant="primary"
              fill="text"
              size="sm"
              className={styles.expandCollapseControlButton}
              onClick={handleExpandCollapse}
            >
              {t('logs.log-line.show-more', 'show more')}
            </Button>
          </div>
        )}
        {collapsed === false && (
          <div className={styles.expandCollapseControl}>
            <Button
              variant="primary"
              fill="text"
              size="sm"
              className={styles.expandCollapseControlButton}
              onClick={handleExpandCollapse}
            >
              {t('logs.log-line.show-less', 'show less')}
            </Button>
          </div>
        )}
        {detailsMode === 'inline' && detailsShown && (
          <InlineLogLineDetails
            logs={logs}
            log={log}
            onResize={handleLogLineResize}
            timeRange={timeRange}
            timeZone={timeZone}
          />
        )}
      </>
    );
  }
);
LogLineComponent.displayName = 'LogLineComponent';

export type LogLineTimestampResolution = 'ms' | 'ns';

interface LogProps {
  collapsed?: boolean;
  displayedFields: string[];
  log: LogListModel;
  showTime: boolean;
  showUniqueLabels?: boolean;
  styles: LogLineStyles;
  timestampResolution: LogLineTimestampResolution;
  wrapLogMessage: boolean;
}

const Log = memo(
  ({ displayedFields, log, showTime, showUniqueLabels, styles, timestampResolution, wrapLogMessage }: LogProps) => {
    const handleLabelsToggle = useCallback(
      (expanded: boolean) => {
        log.uniqueLabelsExpanded = expanded;
      },
      [log]
    );
    return (
      <>
        {showTime && (
          <span className={`${styles.timestamp} level-${log.logLevel} field`}>
            {timestampResolution === 'ms' ? log.timestamp : log.timestampNs}{' '}
          </span>
        )}
        {
          // When logs are unwrapped, we want an empty column space to align with other log lines.
        }
        {(log.displayLevel || !wrapLogMessage) && (
          <span className={`${styles.level} level-${log.logLevel} field`}>{log.displayLevel} </span>
        )}
        {showUniqueLabels && log.uniqueLabels && (
          <span className="field">
            <LogLabels
              addTooltip={true}
              displayAll={log.uniqueLabelsExpanded}
              displayMax={5}
              labels={log.uniqueLabels}
              onDisplayMaxToggle={handleLabelsToggle}
            />
          </span>
        )}
        {displayedFields.length > 0 ? (
          <DisplayedFields displayedFields={displayedFields} log={log} styles={styles} />
        ) : (
          <LogLineBody log={log} styles={styles} />
        )}
      </>
    );
  }
);
Log.displayName = 'Log';

const DisplayedFields = ({
  displayedFields,
  log,
  styles,
}: {
  displayedFields: string[];
  log: LogListModel;
  styles: LogLineStyles;
}) => {
  const { matchingUids, search } = useLogListSearchContext();
  const { syntaxHighlighting, unwrappedColumns, wrapLogMessage } = useLogListContext();

  const searchWords = useMemo(() => {
    const searchWords = log.searchWords && log.searchWords[0] ? log.searchWords.slice() : [];
    if (search && matchingUids?.includes(log.uid)) {
      searchWords.push(search);
    }
    if (!searchWords.length) {
      return undefined;
    }
    return searchWords;
  }, [log.searchWords, log.uid, matchingUids, search]);

  return displayedFields
    .map((field) => {
      if (field === LOG_LINE_BODY_FIELD_NAME) {
        return <LogLineBody log={log} key={field} styles={styles} />;
      }
      if (field === OTEL_LOG_LINE_ATTRIBUTES_FIELD_NAME && syntaxHighlighting) {
        return (
          <span className="field log-syntax-highlight" title={getNormalizedFieldName(field)} key={field}>
            <HighlightedLogRenderer tokens={log.highlightedLogAttributesTokens} />{' '}
          </span>
        );
      }

      const fieldValue = log.getDisplayedFieldValue(field);

      // With wrapped logs, or without unwrapped columns, we skip empty values so they don't appear as an empty space
      if ((wrapLogMessage || !unwrappedColumns) && !fieldValue) {
        return null;
      }

      return (
        <span className="field" title={getNormalizedFieldName(field)} key={field}>
          {searchWords ? (
            <Highlighter
              textToHighlight={fieldValue}
              searchWords={searchWords}
              findChunks={findHighlightChunksInText}
              highlightClassName={styles.matchHighLight}
            />
          ) : (
            fieldValue
          )}{' '}
        </span>
      );
    })
    .filter((field) => field !== null);
};

const LogLineBody = ({ log, styles }: { log: LogListModel; styles: LogLineStyles }) => {
  const { syntaxHighlighting } = useLogListContext();
  const { matchingUids, search } = useLogListSearchContext();

  const highlight = useMemo(() => {
    const searchWords = syntaxHighlighting && log.searchWords && log.searchWords[0] ? log.searchWords.slice() : [];
    if (search && matchingUids?.includes(log.uid)) {
      searchWords.push(search);
    }
    if (!searchWords.length) {
      return undefined;
    }
    return { searchWords, highlightClassName: styles.matchHighLight };
  }, [log.searchWords, log.uid, matchingUids, search, styles.matchHighLight, syntaxHighlighting]);

  if (log.hasAnsi) {
    return (
      <span className="field no-highlighting log-line-body">
        <LogMessageAnsi value={log.body} highlight={highlight} />{' '}
      </span>
    );
  }

  if (!syntaxHighlighting) {
    return highlight ? (
      <Highlighter
        textToHighlight={log.body}
        searchWords={highlight.searchWords}
        findChunks={findHighlightChunksInText}
        highlightClassName={styles.matchHighLight}
      />
    ) : (
      <span className="field no-highlighting log-line-body">{log.body} </span>
    );
  }

  return (
    <span className="field log-syntax-highlight log-line-body">
      <HighlightedLogRenderer tokens={log.highlightedBodyTokens} />{' '}
    </span>
  );
};

export function getGridTemplateColumns(
  dimensions: LogFieldDimension[],
  displayedFields: string[],
  unwrappedColumns: boolean
) {
  const columns = dimensions
    .map((dimension) =>
      dimension.width > 0 && (unwrappedColumns || dimension.internal) ? `${dimension.width}px` : 'max-content'
    )
    .join(' ');
  const logLineWidth = displayedFields.length > 0 ? '' : ' 1fr';
  return `${columns}${logLineWidth}`;
}

function isLogLineClick(target: EventTarget) {
  const targetIsButton = target instanceof HTMLButtonElement || (target instanceof Element && target.closest('button'));
  return !targetIsButton;
}

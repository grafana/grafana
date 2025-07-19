import { css } from '@emotion/css';
import { CSSProperties, memo, useCallback, useEffect, useMemo, useRef, useState, MouseEvent } from 'react';
import Highlighter from 'react-highlight-words';
import tinycolor from 'tinycolor2';

import { findHighlightChunksInText, GrafanaTheme2, LogsDedupStrategy } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, Icon, Tooltip } from '@grafana/ui';

import { LOG_LINE_BODY_FIELD_NAME } from '../LogDetailsBody';
import { LogMessageAnsi } from '../LogMessageAnsi';

import { InlineLogLineDetails } from './LogLineDetails';
import { LogLineMenu } from './LogLineMenu';
import { useLogIsPermalinked, useLogIsPinned, useLogListContext } from './LogListContext';
import { useLogListSearchContext } from './LogListSearchContext';
import { LogListModel } from './processing';
import {
  FIELD_GAP_MULTIPLIER,
  hasUnderOrOverflow,
  LogFieldDimension,
  LogLineVirtualization,
  DEFAULT_LINE_HEIGHT,
} from './virtualization';

export interface Props {
  displayedFields: string[];
  index: number;
  log: LogListModel;
  logs: LogListModel[];
  showTime: boolean;
  style: CSSProperties;
  styles: LogLineStyles;
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
    variant,
    virtualization,
    wrapLogMessage,
  }: LogLineComponentProps) => {
    const {
      detailsDisplayed,
      detailsMode,
      dedupStrategy,
      enableLogDetails,
      fontSize,
      hasLogsWithErrors,
      hasSampledLogs,
      onLogLineHover,
    } = useLogListContext();
    const [collapsed, setCollapsed] = useState<boolean | undefined>(
      wrapLogMessage && log.collapsed !== undefined ? log.collapsed : undefined
    );
    const logLineRef = useRef<HTMLDivElement | null>(null);
    const pinned = useLogIsPinned(log);
    const permalinked = useLogIsPermalinked(log);

    useEffect(() => {
      if (!onOverflow || !logLineRef.current || !virtualization || !height) {
        return;
      }
      const calculatedHeight = typeof height === 'number' ? height : undefined;
      const actualHeight = hasUnderOrOverflow(virtualization, logLineRef.current, calculatedHeight, log.collapsed);
      if (actualHeight) {
        onOverflow(index, log.uid, actualHeight);
      }
    });

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
      setCollapsed(newState);
      log.setCollapsedState(newState);
      onOverflow?.(index, log.uid);
    }, [collapsed, index, log, onOverflow]);

    const handleClick = useCallback(
      (e: MouseEvent<HTMLElement>) => {
        onClick(e, log);
      },
      [log, onClick]
    );

    const detailsShown = detailsDisplayed(log);

    return (
      <>
        <div
          className={`${styles.logLine} ${variant ?? ''} ${pinned ? styles.pinnedLogLine : ''} ${permalinked ? styles.permalinkedLogLine : ''} ${detailsShown ? styles.detailsDisplayed : ''} ${fontSize === 'small' ? styles.fontSizeSmall : ''}`}
          ref={onOverflow ? logLineRef : undefined}
          onMouseEnter={handleMouseOver}
          onFocus={handleMouseOver}
        >
          <LogLineMenu styles={styles} log={log} />
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
          {/* A button element could be used but in Safari it prevents text selection. Fallback available for a11y in LogLineMenu  */}
          {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
          <div
            className={`${styles.fieldsWrapper} ${detailsShown ? styles.detailsDisplayed : ''} ${wrapLogMessage ? styles.wrappedLogLine : `${styles.unwrappedLogLine} unwrapped-log-line`} ${collapsed === true ? styles.collapsedLogLine : ''} ${enableLogDetails ? styles.clickable : ''}`}
            style={
              collapsed && virtualization
                ? { maxHeight: `${virtualization.getTruncationLineCount() * virtualization.getLineHeight()}px` }
                : undefined
            }
            onClick={handleClick}
          >
            <Log
              displayedFields={displayedFields}
              log={log}
              showTime={showTime}
              styles={styles}
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
        {detailsMode === 'inline' && detailsShown && <InlineLogLineDetails logs={logs} log={log} />}
      </>
    );
  }
);
LogLineComponent.displayName = 'LogLineComponent';

interface LogProps {
  displayedFields: string[];
  log: LogListModel;
  showTime: boolean;
  styles: LogLineStyles;
  wrapLogMessage: boolean;
}

const Log = memo(({ displayedFields, log, showTime, styles, wrapLogMessage }: LogProps) => {
  return (
    <>
      {showTime && <span className={`${styles.timestamp} level-${log.logLevel} field`}>{log.timestamp}</span>}
      {
        // When logs are unwrapped, we want an empty column space to align with other log lines.
      }
      {(log.displayLevel || !wrapLogMessage) && (
        <span className={`${styles.level} level-${log.logLevel} field`}>{log.displayLevel}</span>
      )}
      {displayedFields.length > 0 ? (
        <DisplayedFields displayedFields={displayedFields} log={log} styles={styles} />
      ) : (
        <LogLineBody log={log} styles={styles} />
      )}
    </>
  );
});
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

  return displayedFields.map((field) =>
    field === LOG_LINE_BODY_FIELD_NAME ? (
      <LogLineBody log={log} key={field} styles={styles} />
    ) : (
      <span className="field" title={field} key={field}>
        {searchWords ? (
          <Highlighter
            textToHighlight={log.getDisplayedFieldValue(field)}
            searchWords={searchWords}
            findChunks={findHighlightChunksInText}
            highlightClassName={styles.matchHighLight}
          />
        ) : (
          log.getDisplayedFieldValue(field)
        )}
      </span>
    )
  );
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
      <span className="field no-highlighting">
        <LogMessageAnsi value={log.body} highlight={highlight} />
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
      <span className="field no-highlighting">{log.body}</span>
    );
  }

  return <span className="field log-syntax-highlight" dangerouslySetInnerHTML={{ __html: log.highlightedBody }} />;
};

export function getGridTemplateColumns(dimensions: LogFieldDimension[], displayedFields: string[]) {
  const columns = dimensions.map((dimension) => dimension.width).join('px ');
  const logLineWidth = displayedFields.length > 0 ? '' : ' 1fr';
  return `${columns}px${logLineWidth}`;
}

export type LogLineStyles = ReturnType<typeof getStyles>;
export const getStyles = (theme: GrafanaTheme2, virtualization?: LogLineVirtualization) => {
  const colors = {
    critical: '#B877D9',
    error: theme.colors.error.text,
    warning: '#FBAD37',
    debug: '#6E9FFF',
    trace: '#6ed0e0',
    info: '#6CCF8E',
    metadata: theme.colors.text.primary,
    parsedField: theme.colors.text.primary,
  };

  const hoverColor = tinycolor(theme.colors.background.canvas).darken(5).toRgbString();

  return {
    logLine: css({
      color: tinycolor(theme.colors.text.secondary).setAlpha(0.75).toRgbString(),
      display: 'flex',
      gap: theme.spacing(0.5),
      flexDirection: 'row',
      fontFamily: theme.typography.fontFamilyMonospace,
      fontSize: theme.typography.fontSize,
      lineHeight: theme.typography.body.lineHeight,
      wordBreak: 'break-all',
      '&:hover': {
        background: hoverColor,
      },
      '&.infinite-scroll': {
        '&::before': {
          borderTop: `solid 1px ${theme.colors.border.strong}`,
          content: '""',
          height: 0,
          left: 0,
          position: 'absolute',
          top: -3,
          width: '100%',
        },
      },
      '& .log-syntax-highlight': {
        '.log-token-string': {
          color: tinycolor(theme.colors.text.secondary).setAlpha(0.75).toRgbString(),
        },
        '.log-token-duration': {
          color: theme.colors.success.text,
        },
        '.log-token-size': {
          color: theme.colors.success.text,
        },
        '.log-token-uuid': {
          color: theme.colors.success.text,
        },
        '.log-token-key': {
          color: colors.parsedField,
          opacity: 0.9,
          fontWeight: theme.typography.fontWeightMedium,
        },
        '.log-token-json-key': {
          color: colors.parsedField,
          opacity: 0.9,
          fontWeight: theme.typography.fontWeightMedium,
        },
        '.log-token-label': {
          color: colors.metadata,
          fontWeight: theme.typography.fontWeightBold,
        },
        '.log-token-method': {
          color: theme.colors.info.shade,
        },
        '.log-search-match': {
          color: theme.components.textHighlight.text,
          backgroundColor: theme.components.textHighlight.background,
        },
      },
      '& .no-highlighting': {
        color: theme.colors.text.primary,
      },
    }),
    matchHighLight: css({
      color: theme.components.textHighlight.text,
      backgroundColor: theme.components.textHighlight.background,
    }),
    fontSizeSmall: css({
      fontSize: theme.typography.bodySmall.fontSize,
      lineHeight: theme.typography.bodySmall.lineHeight,
    }),
    detailsDisplayed: css({
      background: tinycolor(theme.colors.background.canvas).darken(2).toRgbString(),
    }),
    pinnedLogLine: css({
      backgroundColor: tinycolor(theme.colors.info.transparent).setAlpha(0.25).toString(),
    }),
    permalinkedLogLine: css({
      backgroundColor: tinycolor(theme.colors.info.transparent).setAlpha(0.25).toString(),
    }),
    menuIcon: css({
      height: virtualization?.getLineHeight() ?? DEFAULT_LINE_HEIGHT,
      margin: 0,
      padding: theme.spacing(0, 0, 0, 0.5),
    }),
    logLineMessage: css({
      fontFamily: theme.typography.fontFamily,
      justifyContent: 'center',
    }),
    timestamp: css({
      color: theme.colors.text.disabled,
      display: 'inline-block',
    }),
    duplicates: css({
      flexShrink: 0,
      textAlign: 'center',
      width: theme.spacing(4.5),
    }),
    hasError: css({
      flexShrink: 0,
      width: theme.spacing(2),
      '& svg': {
        position: 'relative',
        top: -1,
      },
    }),
    isSampled: css({
      flexShrink: 0,
      width: theme.spacing(2),
      '& svg': {
        position: 'relative',
        top: -1,
      },
    }),
    logIconError: css({
      color: theme.colors.warning.main,
    }),
    logIconInfo: css({
      color: theme.colors.info.main,
    }),
    level: css({
      color: theme.colors.text.secondary,
      fontWeight: theme.typography.fontWeightBold,
      textTransform: 'uppercase',
      display: 'inline-block',
      '&.level-critical': {
        color: colors.critical,
      },
      '&.level-error': {
        color: colors.error,
      },
      '&.level-warning': {
        color: colors.warning,
      },
      '&.level-info': {
        color: colors.info,
      },
      '&.level-debug': {
        color: colors.debug,
      },
    }),
    loadMoreButton: css({
      background: 'transparent',
      border: 'none',
      display: 'inline',
    }),
    overflows: css({
      outline: 'solid 1px red',
    }),
    clickable: css({
      cursor: 'pointer',
    }),
    unwrappedLogLine: css({
      display: 'grid',
      gridColumnGap: theme.spacing(FIELD_GAP_MULTIPLIER),
      whiteSpace: 'pre',
      paddingBottom: theme.spacing(0.75),
    }),
    wrappedLogLine: css({
      alignSelf: 'flex-start',
      paddingBottom: theme.spacing(0.75),
      whiteSpace: 'pre-wrap',
      '& .field': {
        marginRight: theme.spacing(FIELD_GAP_MULTIPLIER),
      },
      '& .field:last-child': {
        marginRight: 0,
      },
    }),
    fieldsWrapper: css({
      '&:hover': {
        background: hoverColor,
      },
    }),
    collapsedLogLine: css({
      overflow: 'hidden',
    }),
    expandCollapseControl: css({
      display: 'flex',
      justifyContent: 'center',
    }),
    expandCollapseControlButton: css({
      fontWeight: theme.typography.fontWeightLight,
      height: virtualization?.getLineHeight() ?? DEFAULT_LINE_HEIGHT,
      margin: 0,
    }),
  };
};

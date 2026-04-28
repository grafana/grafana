import { css } from '@emotion/css';
import { useBooleanFlagValue } from '@openfeature/react-sdk';
import { Resizable } from 're-resizable';
import { memo, startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type Align } from 'react-window';

import { store, type GrafanaTheme2, type TimeRange } from '@grafana/data';
import { t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { getDragStyles, Icon, ScrollContainer, Tab, TabsBar } from '@grafana/ui';
import { useStyles2 } from '@grafana/ui/themes';

import { getFieldSelectorWidth } from '../fieldSelector/fieldSelectorUtils';

import { getDetailsScrollPosition, saveDetailsScrollPosition, useLogDetailsContext } from './LogDetailsContext';
import { LogLineDetailsComponent } from './LogLineDetailsComponent';
import { LogLineDetailsHeader } from './LogLineDetailsHeader';
import { type LogListFontSize } from './LogList';
import { useLogListContext } from './LogListContext';
import { type LogListModel } from './processing';
import { LOG_LIST_MIN_WIDTH } from './virtualization';

export interface Props {
  containerElement: HTMLDivElement;
  focusLogLine: (log: LogListModel, align?: Align) => void;
  logs: LogListModel[];
  timeRange: TimeRange;
  timeZone: string;
  showControls: boolean;
  showFieldSelector: boolean | undefined;
}

export type LogLineDetailsMode = 'inline' | 'sidebar';

export const LogLineDetails = memo(
  ({ containerElement, focusLogLine, logs, timeRange, timeZone, showControls, showFieldSelector }: Props) => {
    const { noInteractions, fontSize, logOptionsStorageKey } = useLogListContext();
    const { detailsWidth, setDetailsWidth } = useLogDetailsContext();
    const styles = useStyles2(getStyles, 'sidebar', showControls, fontSize);
    const dragStyles = useStyles2(getDragStyles);
    const containerRef = useRef<HTMLDivElement | null>(null);

    const handleResize = useCallback(() => {
      if (containerRef.current) {
        setDetailsWidth(containerRef.current.clientWidth);
      }
    }, [setDetailsWidth]);

    const reportResize = useCallback(() => {
      if (containerRef.current && !noInteractions) {
        reportInteraction('logs_log_line_details_sidebar_resized', {
          width: Math.round(containerRef.current.clientWidth),
        });
      }
    }, [noInteractions]);

    const maxWidth =
      containerElement.clientWidth -
      (showFieldSelector ? getFieldSelectorWidth(logOptionsStorageKey) : 0) -
      LOG_LIST_MIN_WIDTH;

    return (
      <Resizable
        onResize={handleResize}
        onResizeStop={reportResize}
        handleClasses={{ left: dragStyles.dragHandleVertical }}
        defaultSize={{ width: detailsWidth, height: containerElement.clientHeight }}
        size={{ width: detailsWidth, height: containerElement.clientHeight }}
        enable={{ left: true }}
        minWidth={40}
        maxWidth={maxWidth}
      >
        <div className={styles.container} ref={containerRef}>
          <LogLineDetailsTabs
            containerElement={containerElement}
            focusLogLine={focusLogLine}
            logs={logs}
            timeRange={timeRange}
            timeZone={timeZone}
          />
        </div>
      </Resizable>
    );
  }
);
LogLineDetails.displayName = 'LogLineDetails';

const LogLineDetailsTabs = memo(
  ({
    containerElement,
    focusLogLine,
    logs,
    timeRange,
    timeZone,
  }: Pick<Props, 'containerElement' | 'focusLogLine' | 'logs' | 'timeRange' | 'timeZone'>) => {
    const { app, fontSize, noInteractions, wrapLogMessage } = useLogListContext();
    const {
      currentLog,
      closeDetails,
      detailsMode,
      replaceDetails,
      setCurrentLog,
      showDetails,
      setDetailsMode,
      toggleDetails,
    } = useLogDetailsContext();
    const [search, setSearch] = useState('');
    const inputRef = useRef('');

    const styles = useStyles2(getStyles, 'sidebar', undefined, fontSize);

    useEffect(() => {
      // When wrapping is enabled and details is in sidebar mode, the logs panel width changes and the
      // user may lose focus of the log line, so we scroll to it.
      if (wrapLogMessage && currentLog) {
        focusLogLine(currentLog);
      }
      if (!noInteractions) {
        reportInteraction('logs_log_line_details_displayed', {
          mode: 'sidebar',
          app,
        });
      }
      // Once
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
      function handleKeydown(e: KeyboardEvent) {
        if (
          e.target instanceof Element &&
          e.target.contains(containerElement) === false &&
          containerElement.contains(e.target) === false
        ) {
          return;
        }
        let delta: number;
        if (e.key === 'ArrowDown') {
          delta = 1;
        } else if (e.key === 'ArrowUp') {
          delta = -1;
        } else {
          return;
        }
        if (!currentLog || !logs.find((log) => log.uid === currentLog.uid)) {
          return;
        }
        const nextLog = logs[logs.findIndex((log) => log.uid === currentLog.uid) + delta];
        if (!nextLog) {
          return;
        }
        e.preventDefault();
        replaceDetails(nextLog);
        focusLogLine(nextLog, 'auto');
      }
      document.addEventListener('keydown', handleKeydown);
      return () => document.removeEventListener('keydown', handleKeydown);
    }, [containerElement, currentLog, focusLogLine, logs, replaceDetails]);

    const handleSearch = useCallback((newSearch: string) => {
      inputRef.current = newSearch;
      startTransition(() => {
        setSearch(inputRef.current);
      });
    }, []);

    const tabs = useMemo(() => showDetails.slice().reverse(), [showDetails]);

    if (!currentLog) {
      return null;
    }

    return (
      <div className={styles.tabsWrapper}>
        {showDetails.length > 1 && (
          <TabsBar>
            {tabs.map((log) => {
              return (
                <Tab
                  key={log.uid}
                  truncate
                  label={log.entry.substring(0, 25)}
                  active={currentLog.uid === log.uid}
                  onChangeTab={() => setCurrentLog(log)}
                  suffix={() => (
                    <Icon
                      name="times"
                      aria-label={t('logs.log-line-details.remove-log', 'Remove log')}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleDetails(log);
                      }}
                    />
                  )}
                />
              );
            })}
          </TabsBar>
        )}
        <LogLineDetailsHeader
          closeDetails={closeDetails}
          detailsMode={detailsMode}
          focusLogLine={focusLogLine}
          log={currentLog}
          search={search}
          setDetailsMode={setDetailsMode}
          onSearch={handleSearch}
        />
        <ScrollContainer>
          <LogLineDetailsComponent
            log={currentLog}
            logs={logs}
            search={search}
            timeRange={timeRange}
            timeZone={timeZone}
          />
        </ScrollContainer>
      </div>
    );
  }
);
LogLineDetailsTabs.displayName = 'LogLineDetailsTabs';

export interface InlineLogLineDetailsProps {
  log: LogListModel;
  logs: LogListModel[];
  onResize(): void;
  timeRange: TimeRange;
  timeZone: string;
}

export const InlineLogLineDetails = memo(({ logs, log, onResize, timeRange, timeZone }: InlineLogLineDetailsProps) => {
  const { app, fontSize, logOptionsStorageKey, noInteractions } = useLogListContext();
  const { closeDetails, detailsMode, detailsWidth, setDetailsMode } = useLogDetailsContext();
  const styles = useStyles2(getStyles, 'inline', undefined, fontSize);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [search, setSearch] = useState('');
  const inputRef = useRef('');
  const [autoScrolled, setAutoScrolled] = useState(false);
  const inlineLogDetailsNoScrolls = useBooleanFlagValue('inlineLogDetailsNoScrolls', false);
  const [inlineNoScroll, setInlineNoScroll] = useState(
    inlineLogDetailsNoScrolls && logOptionsStorageKey
      ? store.getBool(`${logOptionsStorageKey}.inlineDetailsNoScrolls`, true)
      : undefined
  );

  useEffect(() => {
    if (!noInteractions) {
      reportInteraction('logs_log_line_details_displayed', {
        mode: 'inline',
        app,
      });
    }
  }, [app, noInteractions]);

  useEffect(() => {
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [onResize]);

  const saveScroll = useCallback(() => {
    saveDetailsScrollPosition(log, scrollRef.current?.scrollTop ?? 0);
  }, [log]);

  const handleSearch = useCallback((newSearch: string) => {
    inputRef.current = newSearch;
    startTransition(() => {
      setSearch(inputRef.current);
    });
  }, []);

  // Keep scroll position when adding filters or using displayed fields
  useEffect(() => {
    if (!scrollRef.current || inlineNoScroll || autoScrolled) {
      return;
    }
    if (scrollRef.current.scrollHeight === scrollRef.current.clientHeight) {
      return;
    }
    scrollRef.current.scrollTo(0, getDetailsScrollPosition(log));
    setAutoScrolled(true);
  }, [inlineNoScroll, autoScrolled, log, scrollRef.current?.scrollHeight]);

  return (
    <div className={`${styles.inlineWrapper} log-line-inline-details`} style={{ maxWidth: detailsWidth }}>
      <div className={styles.inlineContainer}>
        <LogLineDetailsHeader
          closeDetails={closeDetails}
          detailsMode={detailsMode}
          inlineNoScroll={inlineNoScroll}
          log={log}
          search={search}
          setDetailsMode={setDetailsMode}
          setInlineNoScroll={setInlineNoScroll}
          onSearch={handleSearch}
        />
        {inlineNoScroll ? (
          <div>
            <LogLineDetailsComponent log={log} logs={logs} search={search} timeRange={timeRange} timeZone={timeZone} />
          </div>
        ) : (
          <ScrollContainer ref={scrollRef} onScroll={saveScroll} overflowY="auto" maxHeight={LOG_LINE_DETAILS_HEIGHT}>
            <LogLineDetailsComponent log={log} logs={logs} search={search} timeRange={timeRange} timeZone={timeZone} />
          </ScrollContainer>
        )}
      </div>
    </div>
  );
});
InlineLogLineDetails.displayName = 'InlineLogLineDetails';

export const LOG_LINE_DETAILS_HEIGHT = 45;

const getStyles = (
  theme: GrafanaTheme2,
  mode: LogLineDetailsMode,
  showControls: boolean | undefined,
  fontSize: LogListFontSize
) => ({
  inlineWrapper: css({
    gridColumn: '1 / -1',
    padding: theme.spacing(1, 2, 1.5, 2),
    marginRight: 1,
  }),
  inlineContainer: css({
    backgroundColor: theme.colors.background.secondary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    fontSize: fontSize === 'small' ? theme.typography.bodySmall.fontSize : undefined,
    lineHeight: fontSize === 'small' ? theme.typography.bodySmall.lineHeight : undefined,
  }),
  container: css({
    backgroundColor: theme.colors.background.elevated,
    border: `1px solid ${theme.colors.border.weak}`,
    borderBottomRightRadius: showControls ? undefined : theme.shape.radius.default,
    borderRight: mode === 'sidebar' && showControls ? 'none' : undefined,
    borderTopRightRadius: showControls ? undefined : theme.shape.radius.default,
    boxShadow: theme.shadows.z3,
    height: '100%',
    fontSize: fontSize === 'small' ? theme.typography.bodySmall.fontSize : undefined,
    lineHeight: fontSize === 'small' ? theme.typography.bodySmall.lineHeight : undefined,
  }),
  tabsWrapper: css({ height: '100%', display: 'flex', flexDirection: 'column' }),
});

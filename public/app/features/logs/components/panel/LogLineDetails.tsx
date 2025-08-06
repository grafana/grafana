import { css } from '@emotion/css';
import { Resizable } from 're-resizable';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { usePrevious } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { getDragStyles, Icon, Tab, TabsBar, useStyles2 } from '@grafana/ui';

import { LogLineDetailsComponent } from './LogLineDetailsComponent';
import { getDetailsScrollPosition, saveDetailsScrollPosition, useLogListContext } from './LogListContext';
import { LogListModel } from './processing';
import { LOG_LIST_MIN_WIDTH } from './virtualization';

export interface Props {
  containerElement: HTMLDivElement;
  focusLogLine: (log: LogListModel) => void;
  logs: LogListModel[];
  onResize(): void;
}

export type LogLineDetailsMode = 'inline' | 'sidebar';

export const LogLineDetails = memo(({ containerElement, focusLogLine, logs, onResize }: Props) => {
  const { detailsWidth, noInteractions, setDetailsWidth } = useLogListContext();
  const styles = useStyles2(getStyles, 'sidebar');
  const dragStyles = useStyles2(getDragStyles);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const handleResize = useCallback(() => {
    if (containerRef.current) {
      setDetailsWidth(containerRef.current.clientWidth);
    }
    onResize();
  }, [onResize, setDetailsWidth]);

  const reportResize = useCallback(() => {
    if (containerRef.current && !noInteractions) {
      reportInteraction('logs_log_line_details_sidebar_resized', {
        width: Math.round(containerRef.current.clientWidth),
      });
    }
  }, [noInteractions]);

  const maxWidth = containerElement.clientWidth - LOG_LIST_MIN_WIDTH;

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
        <LogLineDetailsTabs focusLogLine={focusLogLine} logs={logs} />
      </div>
    </Resizable>
  );
});
LogLineDetails.displayName = 'LogLineDetails';

const LogLineDetailsTabs = memo(({ focusLogLine, logs }: Pick<Props, 'focusLogLine' | 'logs'>) => {
  const { app, closeDetails, noInteractions, showDetails, toggleDetails } = useLogListContext();
  const [currentLog, setCurrentLog] = useState(showDetails[0]);
  const previousShowDetails = usePrevious(showDetails);
  const styles = useStyles2(getStyles, 'sidebar');

  useEffect(() => {
    focusLogLine(currentLog);
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
    if (!showDetails.length) {
      closeDetails();
      return;
    }
    // Focus on the recently open
    if (!previousShowDetails || showDetails.length > previousShowDetails.length) {
      setCurrentLog(showDetails[showDetails.length - 1]);
      return;
    } else if (!showDetails.find((log) => log.uid === currentLog.uid)) {
      setCurrentLog(showDetails[showDetails.length - 1]);
    }
  }, [closeDetails, currentLog.uid, previousShowDetails, showDetails]);

  return (
    <>
      {showDetails.length > 1 && (
        <TabsBar>
          {showDetails.map((log) => {
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
                    onClick={() => toggleDetails(log)}
                  />
                )}
              />
            );
          })}
        </TabsBar>
      )}
      <div className={styles.scrollContainer}>
        <LogLineDetailsComponent focusLogLine={focusLogLine} log={currentLog} logs={logs} />
      </div>
    </>
  );
});
LogLineDetailsTabs.displayName = 'LogLineDetailsTabs';

export interface InlineLogLineDetailsProps {
  log: LogListModel;
  logs: LogListModel[];
}

export const InlineLogLineDetails = memo(({ logs, log }: InlineLogLineDetailsProps) => {
  const { app, noInteractions } = useLogListContext();
  const styles = useStyles2(getStyles, 'inline');
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!noInteractions) {
      reportInteraction('logs_log_line_details_displayed', {
        mode: 'inline',
        app,
      });
    }
  }, [app, noInteractions]);

  const saveScroll = useCallback(() => {
    saveDetailsScrollPosition(log, scrollRef.current?.scrollTop ?? 0);
  }, [log]);

  useEffect(() => {
    if (!scrollRef.current) {
      return;
    }
    scrollRef.current.scrollTop = getDetailsScrollPosition(log);
  }, [log]);

  return (
    <div className={`${styles.inlineWrapper} log-line-inline-details`}>
      <div className={styles.container}>
        <div className={styles.scrollContainer} ref={scrollRef} onScroll={saveScroll}>
          <LogLineDetailsComponent log={log} logs={logs} />
        </div>
      </div>
    </div>
  );
});
InlineLogLineDetails.displayName = 'InlineLogLineDetails';

export const LOG_LINE_DETAILS_HEIGHT = 35;

const getStyles = (theme: GrafanaTheme2, mode: LogLineDetailsMode) => ({
  inlineWrapper: css({
    gridColumn: '1 / -1',
    height: `${LOG_LINE_DETAILS_HEIGHT}vh`,
    paddingBottom: theme.spacing(0.5),
    marginRight: 1,
  }),
  container: css({
    overflow: 'auto',
    height: '100%',
    boxShadow: theme.shadows.z1,
    border: `1px solid ${theme.colors.border.medium}`,
    borderRight: mode === 'sidebar' ? 'none' : undefined,
  }),
  scrollContainer: css({
    overflow: 'auto',
    height: '100%',
  }),
  componentWrapper: css({
    padding: theme.spacing(0, 1, 1, 1),
  }),
});

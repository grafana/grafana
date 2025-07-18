import { css } from '@emotion/css';
import { Resizable } from 're-resizable';
import { memo, useCallback, useEffect, useRef } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { getDragStyles, useStyles2 } from '@grafana/ui';

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

export const LogLineDetails = ({ containerElement, focusLogLine, logs, onResize }: Props) => {
  const { detailsWidth, noInteractions, setDetailsWidth, showDetails } = useLogListContext();
  const styles = useStyles2(getStyles, 'sidebar');
  const dragStyles = useStyles2(getDragStyles);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    focusLogLine(showDetails[0]);
    if (!noInteractions) {
      reportInteraction('logs_log_line_details_displayed', {
        mode: 'sidebar',
      });
    }
    // Just once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  if (!showDetails.length) {
    return null;
  }

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
        <div className={styles.scrollContainer}>
          <LogLineDetailsComponent log={showDetails[0]} logs={logs} />
        </div>
      </div>
    </Resizable>
  );
};

export interface InlineLogLineDetailsProps {
  logs: LogListModel[];
}

export const InlineLogLineDetails = memo(({ logs }: InlineLogLineDetailsProps) => {
  const { noInteractions, showDetails } = useLogListContext();
  const styles = useStyles2(getStyles, 'inline');
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!noInteractions) {
      reportInteraction('logs_log_line_details_displayed', {
        mode: 'inline',
      });
    }
  }, [noInteractions]);

  const saveScroll = useCallback(() => {
    saveDetailsScrollPosition(showDetails[0], scrollRef.current?.scrollTop ?? 0);
  }, [showDetails]);

  useEffect(() => {
    if (!scrollRef.current) {
      return;
    }
    scrollRef.current.scrollTop = getDetailsScrollPosition(showDetails[0]);
  }, [showDetails]);

  if (!showDetails.length) {
    return null;
  }

  return (
    <div className={`${styles.inlineWrapper} log-line-inline-details`}>
      <div className={styles.container}>
        <div className={styles.scrollContainer} ref={scrollRef} onScroll={saveScroll}>
          <LogLineDetailsComponent log={showDetails[0]} logs={logs} />
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

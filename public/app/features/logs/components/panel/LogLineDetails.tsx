import { css } from '@emotion/css';
import { Resizable } from 're-resizable';
import { useCallback, useEffect, useRef } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { getDragStyles, useStyles2 } from '@grafana/ui';

import { LogLineDetailsComponent } from './LogLineDetailsComponent';
import { useLogListContext } from './LogListContext';
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
  const { detailsWidth, setDetailsWidth, showDetails } = useLogListContext();
  const styles = useStyles2(getStyles);
  const dragStyles = useStyles2(getDragStyles);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    focusLogLine(showDetails[0]);
    // Just once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleResize = useCallback(() => {
    if (containerRef.current) {
      setDetailsWidth(containerRef.current.clientWidth);
    }
    onResize();
  }, [onResize, setDetailsWidth]);

  const maxWidth = containerElement.clientWidth - LOG_LIST_MIN_WIDTH;

  if (!showDetails.length) {
    return null;
  }

  return (
    <Resizable
      onResize={handleResize}
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

export const InlineLogLineDetails = ({ logs }: InlineLogLineDetailsProps) => {
  const { showDetails } = useLogListContext();
  const styles = useStyles2(getStyles);

  if (!showDetails.length) {
    return null;
  }

  return (
    <div className={styles.container} style={{ height: '30vh' }}>
      <div className={styles.scrollContainer}>
        <LogLineDetailsComponent log={showDetails[0]} logs={logs} />
      </div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    overflow: 'auto',
    height: '100%',
    boxShadow: theme.shadows.z1,
    border: `1px solid ${theme.colors.border.medium}`,
    borderRight: 'none',
  }),
  scrollContainer: css({
    overflow: 'auto',
    height: '100%',
  }),
  componentWrapper: css({
    padding: theme.spacing(0, 1, 1, 1),
  }),
});

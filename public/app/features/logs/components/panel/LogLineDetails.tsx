import { css } from '@emotion/css';
import { Resizable } from 're-resizable';
import { useCallback, useRef } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { getDragStyles, useStyles2 } from '@grafana/ui';

import { LogLineDetailsComponent } from './LogLineDetailsComponent';
import { useLogListContext } from './LogListContext';
import { LogListModel } from './processing';
import { LOG_LIST_MIN_WIDTH } from './virtualization';

export interface Props {
  containerElement: HTMLDivElement;
  logOptionsStorageKey?: string;
  logs: LogListModel[];
  onResize(): void;
}

export const LogLineDetails = ({ containerElement, logOptionsStorageKey, logs, onResize }: Props) => {
  const { detailsWidth, setDetailsWidth, showDetails } = useLogListContext();
  const styles = useStyles2(getStyles);
  const dragStyles = useStyles2(getDragStyles);
  const containerRef = useRef<HTMLDivElement | null>(null);

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
          <LogLineDetailsComponent log={showDetails[0]} logOptionsStorageKey={logOptionsStorageKey} logs={logs} />
        </div>
      </div>
    </Resizable>
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

import { css } from '@emotion/css';
import { Resizable } from 're-resizable';
import { useCallback, useRef } from 'react';

import { useTheme2 } from '@grafana/ui';

import { LogDetails } from '../LogDetails';
import { getLogRowStyles } from '../getLogRowStyles';

import { useLogListContext } from './LogListContext';
import { LogListModel } from './processing';

interface Props {
  logs: LogListModel[];
}

export const LogLineDetails = ({ logs }: Props) => {
  const { detailsWidth, setDetailsWidth, showDetails, wrapLogMessage } = useLogListContext();
  const getRows = useCallback(() => logs, [logs]);
  const logRowsStyles = getLogRowStyles(useTheme2());
  const containerRef = useRef<HTMLDivElement | null>(null);

  const handleResize = useCallback(() => {
    if (containerRef.current) {
      setDetailsWidth(containerRef.current.clientWidth);
    }
  }, [setDetailsWidth]);

  return (
    <Resizable onResize={handleResize} defaultSize={detailsWidth ? { width: detailsWidth } : undefined}>
      <div className={styles.container} ref={containerRef}>
        <table width="100%">
          <tbody>
            <LogDetails
              getRows={getRows}
              mode="sidebar"
              row={showDetails[0]}
              showDuplicates={false}
              styles={logRowsStyles}
              wrapLogMessage={wrapLogMessage}
            />
          </tbody>
        </table>
      </div>
    </Resizable>
  );
};

const styles = {
  container: css({
    overflow: 'auto',
  }),
};

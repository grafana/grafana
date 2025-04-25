import { css } from '@emotion/css';
import { useMemo } from 'react';

import { EventBusSrv, GrafanaTheme2 } from '@grafana/data';
import { useTheme2 } from '@grafana/ui';

import { LogsTableWrap } from '../../explore/Logs/LogsTableWrap';

import { LogRowsComponentProps } from './ControlledLogRows';
import { useLogListContext } from './panel/LogListContext';
import { LogListControls } from './panel/LogListControls';

export const ControlledLogsTable = ({
  loading,
  loadMoreLogs,
  deduplicatedRows = [],
  range,
  splitOpen,
  onClickFilterLabel,
  onClickFilterOutLabel,
  panelState,
  datasourceType,
  updatePanelState,
  width,
  logsTableFrames,
  visualisationType,
  ...rest
}: LogRowsComponentProps) => {
  const { sortOrder } = useLogListContext();
  const eventBus = useMemo(() => new EventBusSrv(), []);

  const theme = useTheme2();
  const styles = getStyles(theme);

  if (!splitOpen || !width || !updatePanelState) {
    console.error('<ControlledLogsTable>: Missing required props.');
    return;
  }

  return (
    <div className={styles.logRowsContainer}>
      <LogListControls eventBus={eventBus} visualisationType={visualisationType} />
      <div className={styles.logRows} data-testid="logRowsTable">
        {/* Width should be full width minus logs navigation and padding */}
        <LogsTableWrap
          logsSortOrder={sortOrder}
          range={range}
          splitOpen={splitOpen}
          timeZone={rest.timeZone}
          width={width - 45}
          logsFrames={logsTableFrames ?? []}
          onClickFilterLabel={onClickFilterLabel}
          onClickFilterOutLabel={onClickFilterOutLabel}
          panelState={panelState}
          theme={theme}
          updatePanelState={updatePanelState}
          datasourceType={datasourceType}
        />
      </div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    logRows: css({
      overflowY: 'visible',
      width: '100%',
    }),
    logRowsContainer: css({
      display: 'flex',
      flexDirection: 'row-reverse',
    }),
  };
};

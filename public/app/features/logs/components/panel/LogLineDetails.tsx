import { useCallback } from 'react';

import { useTheme2 } from '@grafana/ui';

import { LogDetails } from '../LogDetails';
import { getLogRowStyles } from '../getLogRowStyles';

import { useLogListContext } from './LogListContext';
import { LogListModel } from './processing';

interface Props {
  logs: LogListModel[];
}

export const LogLineDetails = ({ logs }: Props) => {
  const { showDetails, wrapLogMessage } = useLogListContext();
  const getRows = useCallback(() => logs, [logs]);
  const logRowsStyles = getLogRowStyles(useTheme2());
  return (
    <div>
      <table>
        <LogDetails
          getRows={getRows}
          noLevel
          row={showDetails[0]}
          showDuplicates={false}
          styles={logRowsStyles}
          wrapLogMessage={wrapLogMessage}
        />
      </table>
    </div>
  );
};

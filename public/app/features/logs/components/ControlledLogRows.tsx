import { forwardRef } from 'react';

import {
  type AbsoluteTimeRange,
  CoreApp,
  type DataFrame,
  type ExploreLogsPanelState,
  type LogLevel,
  type LogRowModel,
  type LogsMetaItem,
  LogsSortOrder,
  type SplitOpen,
  type TimeRange,
  type TimeZone,
  type LogsDedupStrategy,
} from '@grafana/data';

import { type LogsVisualisationType } from '../../explore/Logs/constants';

import { ControlledLogsTable } from './ControlledLogsTable';
import { type LogListOptions } from './panel/LogList';
import { LogListContextProvider } from './panel/LogListContext';

export interface ControlledLogRowsProps {
  absoluteRange?: AbsoluteTimeRange;
  datasourceType?: string;
  dedupStrategy: LogsDedupStrategy;
  displayedFields?: string[];
  exploreId?: string;
  filterLevels?: LogLevel[];
  logOptionsStorageKey?: string;
  logRows?: LogRowModel[];
  logsMeta?: LogsMetaItem[];
  logsSortOrder?: LogsSortOrder;
  logsTableFrames?: DataFrame[];
  onClickFilterLabel?: (key: string, value: string, frame?: DataFrame) => void;
  onClickFilterOutLabel?: (key: string, value: string, frame?: DataFrame) => void;
  onLogOptionsChange?: (option: LogListOptions, value: string | boolean | string[]) => void;
  panelState?: ExploreLogsPanelState;
  prettifyLogMessage?: boolean;
  range: TimeRange;
  showLabels?: boolean;
  showTime?: boolean;
  splitOpen: SplitOpen;
  timeZone: TimeZone;
  updatePanelState: (panelState: Partial<ExploreLogsPanelState>) => void;
  visualisationType: LogsVisualisationType;
  width: number;
  wrapLogMessage?: boolean;
}

export const ControlledLogRows = forwardRef<HTMLDivElement | null, ControlledLogRowsProps>(
  (
    {
      dedupStrategy,
      filterLevels,
      logOptionsStorageKey,
      logsMeta,
      logsSortOrder,
      prettifyLogMessage,
      onLogOptionsChange,
      showLabels,
      showTime,
      wrapLogMessage,
      ...rest
    }: ControlledLogRowsProps,
    ref
  ) => {
    return (
      <LogListContextProvider
        app={CoreApp.Explore}
        displayedFields={rest.displayedFields ?? []}
        dedupStrategy={dedupStrategy}
        filterLevels={filterLevels}
        fontSize="default"
        logOptionsStorageKey={logOptionsStorageKey}
        logs={rest.logRows ?? []}
        logsMeta={logsMeta}
        prettifyJSON={prettifyLogMessage}
        showControls
        showTime={showTime ?? false}
        showUniqueLabels={showLabels}
        sortOrder={logsSortOrder || LogsSortOrder.Descending}
        onLogOptionsChange={onLogOptionsChange}
        wrapLogMessage={wrapLogMessage ?? false}
      >
        <ControlledLogsTable ref={ref} {...rest} />
      </LogListContextProvider>
    );
  }
);

ControlledLogRows.displayName = 'ControlledLogRows';

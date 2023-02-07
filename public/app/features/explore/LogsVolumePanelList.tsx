import { groupBy, sortBy, toPairs, fromPairs } from 'lodash';
import React, { useMemo } from 'react';

import { AbsoluteTimeRange, DataQueryResponse, EventBus, SplitOpen, TimeZone } from '@grafana/data';

import { LogsVolumePanel } from './LogsVolumePanel';

type Props = {
  logsVolumeData: DataQueryResponse | undefined;
  absoluteRange: AbsoluteTimeRange;
  logLinesBasedData: DataQueryResponse | undefined;
  logLinesBasedDataVisibleRange: AbsoluteTimeRange | undefined;
  timeZone: TimeZone;
  splitOpen: SplitOpen;
  width: number;
  onUpdateTimeRange: (timeRange: AbsoluteTimeRange) => void;
  onLoadLogsVolume: () => void;
  onHiddenSeriesChanged: (hiddenSeries: string[]) => void;
  eventBus: EventBus;
};

export const LogsVolumePanelList = ({
  logsVolumeData,
  absoluteRange,
  onUpdateTimeRange,
  width,
  onLoadLogsVolume,
  onHiddenSeriesChanged,
  eventBus,
  splitOpen,
  timeZone,
}: Props) => {
  const logVolumes = useMemo(() => {
    const groups = groupBy(logsVolumeData?.data || [], 'meta.custom.datasourceUid');
    const pairs = toPairs(groups);
    const sorted = sortBy(pairs, 'meta.custom.datasourceName');
    return fromPairs(sorted);
  }, [logsVolumeData]);

  const numberOfLogVolumes = Object.keys(logVolumes).length;

  return (
    <>
      {Object.keys(logVolumes).map((name, index) => {
        const logsVolumeData = { data: logVolumes[name] };
        const title = logsVolumeData.data[0]?.meta?.custom?.mixedDataSourceName || '';
        return (
          <LogsVolumePanel
            title={numberOfLogVolumes > 1 ? title : ''}
            key={index}
            absoluteRange={absoluteRange}
            width={width}
            logsVolumeData={logsVolumeData}
            logLinesBasedDataVisibleRange={undefined}
            logLinesBasedData={undefined}
            onUpdateTimeRange={onUpdateTimeRange}
            timeZone={timeZone}
            splitOpen={splitOpen}
            onLoadLogsVolume={onLoadLogsVolume}
            // TODO: Support filtering level from multiple log levels
            onHiddenSeriesChanged={numberOfLogVolumes > 1 ? () => {} : onHiddenSeriesChanged}
            eventBus={eventBus}
          />
        );
      })}
    </>
  );
};

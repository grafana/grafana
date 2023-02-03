import { groupBy } from 'lodash';
import React, { useMemo } from 'react';

import { AbsoluteTimeRange, DataQueryResponse, EventBus, SplitOpen, TimeZone } from '@grafana/data';

import { LogsVolumePanel } from '../LogsVolumePanel';

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
  eventBus,
  splitOpen,
  timeZone,
}: Props) => {
  const logVolumes = useMemo(() => {
    return groupBy(logsVolumeData?.data || [], 'meta.custom.logsVolumeSourceUid');
  }, [logsVolumeData]);

  const onToggleLogLevel = () => {};

  return (
    <>
      {Object.keys(logVolumes).map((name, index) => {
        console.log(name);
        return (
          <LogsVolumePanel
            key={index}
            absoluteRange={absoluteRange}
            width={width}
            logsVolumeData={{ data: logVolumes[name] }}
            logLinesBasedDataVisibleRange={undefined}
            logLinesBasedData={undefined}
            onUpdateTimeRange={onUpdateTimeRange}
            timeZone={timeZone}
            splitOpen={splitOpen}
            onLoadLogsVolume={onLoadLogsVolume}
            onHiddenSeriesChanged={onToggleLogLevel}
            eventBus={eventBus}
          />
        );
      })}
    </>
  );
};

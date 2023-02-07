import { css } from '@emotion/css';
import { groupBy, sortBy, toPairs, fromPairs } from 'lodash';
import React, { useMemo } from 'react';

import {
  AbsoluteTimeRange,
  DataFrame,
  DataQueryResponse,
  EventBus,
  getLogsVolumeDataSourceInfo,
  GrafanaTheme2,
  isLogsVolumeLimited,
  SplitOpen,
  TimeZone,
} from '@grafana/data';
import { Button, InlineField, useStyles2 } from '@grafana/ui';

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

  const styles = useStyles2(getStyles);

  const numberOfLogVolumes = Object.keys(logVolumes).length;
  const containsLimited = Object.values(logVolumes).some((data: DataFrame[]) => {
    return isLogsVolumeLimited(data);
  });
  const containsZoomed = Object.values(logVolumes).some((data: DataFrame[]) => {
    const zoomRatio = logsLevelZoomRatio(data, absoluteRange);
    return !isLogsVolumeLimited(data) && zoomRatio && zoomRatio < 1;
  });

  let limitedInfo;
  if (containsLimited) {
    const limitedInfoText =
      numberOfLogVolumes > 1
        ? 'Some datasources does not support full-range histograms. "All visible logs" graph is based on the logs seen in all responses.'
        : 'This datasource does not support full-range histograms. The graph is based on the logs seen in the response.';
    limitedInfo = <div className={styles.oldInfoText}>{limitedInfoText}</div>;
  }

  let zoomedInfo;
  if (containsZoomed) {
    zoomedInfo = (
      <InlineField label="Reload log volume" transparent>
        <Button size="xs" icon="sync" variant="secondary" onClick={onLoadLogsVolume} id="reload-volume" />
      </InlineField>
    );
  }

  let extraInfo = (
    <>
      {limitedInfo}
      {zoomedInfo}
    </>
  );

  return (
    <>
      {Object.keys(logVolumes).map((name, index) => {
        const logsVolumeData = { data: logVolumes[name] };
        const title = getLogsVolumeDataSourceInfo(logVolumes[name]).name;
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
      <div className={styles.extraInfoContainer}>{extraInfo}</div>
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    extraInfoContainer: css`
      display: flex;
      justify-content: end;
      position: absolute;
      right: 5px;
      top: 5px;
    `,
    oldInfoText: css`
      font-size: ${theme.typography.size.sm};
      color: ${theme.colors.text.secondary};
    `,
  };
};

function logsLevelZoomRatio(
  logsVolumeData: DataFrame[] | undefined,
  selectedTimeRange: AbsoluteTimeRange
): number | undefined {
  const dataRange = logsVolumeData && logsVolumeData[0] && logsVolumeData[0].meta?.custom?.absoluteRange;
  return dataRange ? (selectedTimeRange.from - selectedTimeRange.to) / (dataRange.from - dataRange.to) : undefined;
}

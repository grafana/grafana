import { css } from '@emotion/css';
import { groupBy, mapValues } from 'lodash';
import React, { useMemo } from 'react';

import {
  AbsoluteTimeRange,
  DataFrame,
  DataQueryResponse,
  EventBus,
  GrafanaTheme2,
  isLogsVolumeLimited,
  LoadingState,
  SplitOpen,
  TimeZone,
} from '@grafana/data';
import { Button, InlineField, useStyles2 } from '@grafana/ui';

import { mergeLogsVolumeDataFrames } from '../logs/utils';

import { LogsVolumePanel } from './LogsVolumePanel';
import { SupplementaryResultError } from './SupplementaryResultError';
import { isTimeoutErrorResponse } from './utils/logsVolumeResponse';

type Props = {
  logsVolumeData: DataQueryResponse | undefined;
  absoluteRange: AbsoluteTimeRange;
  timeZone: TimeZone;
  splitOpen: SplitOpen;
  width: number;
  onUpdateTimeRange: (timeRange: AbsoluteTimeRange) => void;
  onLoadLogsVolume: () => void;
  onHiddenSeriesChanged: (hiddenSeries: string[]) => void;
  eventBus: EventBus;
  onClose?(): void;
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
  onClose,
}: Props) => {
  const logVolumes: Record<string, DataFrame[]> = useMemo(() => {
    const grouped = groupBy(logsVolumeData?.data || [], 'meta.custom.datasourceName');
    return mapValues(grouped, (value) => {
      return mergeLogsVolumeDataFrames(value);
    });
  }, [logsVolumeData]);

  const styles = useStyles2(getStyles);

  const numberOfLogVolumes = Object.keys(logVolumes).length;

  const containsZoomed = Object.values(logVolumes).some((data: DataFrame[]) => {
    const zoomRatio = logsLevelZoomRatio(data, absoluteRange);
    return !isLogsVolumeLimited(data) && zoomRatio && zoomRatio < 1;
  });

  const timeoutError = isTimeoutErrorResponse(logsVolumeData) || true;

  if (logsVolumeData?.state === LoadingState.Loading) {
    return <span>Loading...</span>;
  } else if (timeoutError) {
    return (
      <SupplementaryResultError
        title="The logs volume query has timed out"
        // Using info to avoid users thinking that the actual query has failed.
        severity="info"
        suggestedAction="Retry"
        onSuggestedAction={onLoadLogsVolume}
        onRemove={onClose}
      />
    );
  } else if (logsVolumeData?.error !== undefined) {
    return <SupplementaryResultError error={logsVolumeData.error} title="Failed to load log volume for this query" />;
  }
  return (
    <div className={styles.listContainer}>
      {Object.keys(logVolumes).map((name, index) => {
        const logsVolumeData = { data: logVolumes[name] };
        return (
          <LogsVolumePanel
            key={index}
            absoluteRange={absoluteRange}
            width={width}
            logsVolumeData={logsVolumeData}
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
      {containsZoomed && (
        <div className={styles.extraInfoContainer}>
          <InlineField label="Reload log volume" transparent>
            <Button size="xs" icon="sync" variant="secondary" onClick={onLoadLogsVolume} id="reload-volume" />
          </InlineField>
        </div>
      )}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    listContainer: css`
      padding-top: 10px;
    `,
    extraInfoContainer: css`
      display: flex;
      justify-content: end;
      position: absolute;
      right: 5px;
      top: 5px;
    `,
    oldInfoText: css`
      font-size: ${theme.typography.bodySmall.fontSize};
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

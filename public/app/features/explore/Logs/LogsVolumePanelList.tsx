import { css } from '@emotion/css';
import { flatten, groupBy, mapValues, sortBy } from 'lodash';
import { useMemo } from 'react';
import * as React from 'react';

import {
  AbsoluteTimeRange,
  DataFrame,
  DataQueryResponse,
  DataTopic,
  dateTime,
  EventBus,
  GrafanaTheme2,
  LoadingState,
  SplitOpen,
  TimeRange,
  TimeZone,
} from '@grafana/data';
import { Button, InlineField, Alert, useStyles2, SeriesVisibilityChangeMode } from '@grafana/ui';

import { mergeLogsVolumeDataFrames, isLogsVolumeLimited, getLogsVolumeMaximumRange } from '../../logs/utils';
import { SupplementaryResultError } from '../SupplementaryResultError';

import { LogsVolumePanel } from './LogsVolumePanel';
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
  toggleLegendRef?: React.MutableRefObject<(name: string, mode: SeriesVisibilityChangeMode) => void>;
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
  toggleLegendRef,
}: Props) => {
  const {
    logVolumes,
    maximumValue: allLogsVolumeMaximumValue,
    maximumRange: allLogsVolumeMaximumRange,
    annotations,
  } = useMemo(() => {
    let maximumValue = -Infinity;
    const data = logsVolumeData?.data.filter((frame: DataFrame) => frame.meta?.dataTopic !== DataTopic.Annotations);
    const annotations =
      logsVolumeData?.data.filter((frame: DataFrame) => frame.meta?.dataTopic === DataTopic.Annotations) || [];
    const sorted = sortBy(data || [], 'meta.custom.datasourceName');
    const grouped = groupBy(sorted, 'meta.custom.datasourceName');
    const logVolumes = mapValues(grouped, (value) => {
      const mergedData = mergeLogsVolumeDataFrames(value);
      maximumValue = Math.max(maximumValue, mergedData.maximum);
      return mergedData.dataFrames;
    });
    const maximumRange = getLogsVolumeMaximumRange(flatten(Object.values(logVolumes)));
    return {
      maximumValue,
      maximumRange,
      logVolumes,
      annotations,
    };
  }, [logsVolumeData]);

  const styles = useStyles2(getStyles);

  const numberOfLogVolumes = Object.keys(logVolumes).length;

  const containsZoomed = Object.values(logVolumes).some((data: DataFrame[]) => {
    const zoomRatio = logsLevelZoomRatio(data, absoluteRange);
    return !isLogsVolumeLimited(data) && zoomRatio && zoomRatio < 1;
  });

  const timeoutError = isTimeoutErrorResponse(logsVolumeData);

  const from = dateTime(Math.max(absoluteRange.from, allLogsVolumeMaximumRange.from));
  const to = dateTime(Math.min(absoluteRange.to, allLogsVolumeMaximumRange.to));
  const visibleRange: TimeRange = { from, to, raw: { from, to } };

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

  if (numberOfLogVolumes === 0) {
    return (
      <div className={styles.alertContainer}>
        <Alert severity="info" title="No logs volume available">
          No volume information available for the current queries and time range.
        </Alert>
      </div>
    );
  }

  return (
    <div className={styles.listContainer}>
      {Object.keys(logVolumes).map((name, index) => {
        const logsVolumeData = { data: logVolumes[name] };
        return (
          <LogsVolumePanel
            toggleLegendRef={toggleLegendRef}
            key={index}
            timeRange={visibleRange}
            allLogsVolumeMaximum={allLogsVolumeMaximumValue}
            width={width}
            logsVolumeData={logsVolumeData}
            onUpdateTimeRange={onUpdateTimeRange}
            timeZone={timeZone}
            splitOpen={splitOpen}
            onLoadLogsVolume={onLoadLogsVolume}
            // TODO: Support filtering level from multiple log levels
            onHiddenSeriesChanged={numberOfLogVolumes > 1 ? () => {} : onHiddenSeriesChanged}
            eventBus={eventBus}
            annotations={annotations}
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
    alertContainer: css`
      width: 50%;
      min-width: ${theme.breakpoints.values.sm}px;
      margin: 0 auto;
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

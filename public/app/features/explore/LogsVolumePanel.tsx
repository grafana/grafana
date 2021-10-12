import { AbsoluteTimeRange, DataQueryResponse, LoadingState, SplitOpen, TimeZone } from '@grafana/data';
import { Alert, Button, Collapse, useTheme2 } from '@grafana/ui';
import { ExploreGraph } from './ExploreGraph';
import React from 'react';
import { ExploreId } from '../../types';
import { css } from '@emotion/css';

type Props = {
  exploreId: ExploreId;
  loadLogsVolumeData: (exploreId: ExploreId) => void;
  logsVolumeData?: DataQueryResponse;
  absoluteRange: AbsoluteTimeRange;
  timeZone: TimeZone;
  splitOpen: SplitOpen;
  width: number;
  onUpdateTimeRange: (timeRange: AbsoluteTimeRange) => void;
  onLoadLogsVolume: () => void;
};

export function LogsVolumePanel(props: Props) {
  const { width, logsVolumeData, absoluteRange, timeZone, splitOpen, onUpdateTimeRange, onLoadLogsVolume } = props;
  const theme = useTheme2();
  const spacing = parseInt(theme.spacing(2).slice(0, -2), 10);
  const height = 150;

  let LogsVolumePanelContent;

  if (!logsVolumeData) {
    return null;
  } else if (logsVolumeData?.error) {
    return (
      <Alert title="Failed to load volume logs for this query">
        {logsVolumeData.error.data?.message || logsVolumeData.error.statusText || logsVolumeData.error.message}
      </Alert>
    );
  } else if (logsVolumeData?.state === LoadingState.Loading) {
    LogsVolumePanelContent = <span>Logs volume is loading...</span>;
  } else if (logsVolumeData?.data) {
    if (logsVolumeData.data.length > 0) {
      LogsVolumePanelContent = (
        <ExploreGraph
          loadingState={LoadingState.Done}
          data={logsVolumeData.data}
          height={height}
          width={width - spacing}
          absoluteRange={absoluteRange}
          onChangeTime={onUpdateTimeRange}
          timeZone={timeZone}
          splitOpenFn={splitOpen}
        />
      );
    } else {
      LogsVolumePanelContent = <span>No volume data.</span>;
    }
  }

  const zoomLevel = logsLevelZoomRatio(logsVolumeData, absoluteRange);
  let zoomLevelInfo;

  if (zoomLevel !== undefined && zoomLevel < 1) {
    zoomLevelInfo = (
      <>
        <span
          style={{
            padding: '8px',
            fontSize: `${theme.typography.bodySmall.fontSize}`,
          }}
        >
          Logs volume zoom ~ {(zoomLevel * 100).toFixed(0)}%. Reload to show higher resolution
        </span>
        <Button size="xs" icon="sync" variant="secondary" onClick={onLoadLogsVolume} />
      </>
    );
  }

  return (
    <Collapse label="Logs volume" isOpen={true} loading={logsVolumeData?.state === LoadingState.Loading}>
      <div
        style={{ height }}
        className={css({
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        })}
      >
        {LogsVolumePanelContent}
      </div>
      <div
        className={css({
          display: 'flex',
          justifyContent: 'end',
          position: 'absolute',
          right: '5px',
          top: '5px',
        })}
      >
        {zoomLevelInfo}
      </div>
    </Collapse>
  );
}

function logsLevelZoomRatio(
  logsVolumeData: DataQueryResponse | undefined,
  selectedTimeRange: AbsoluteTimeRange
): number | undefined {
  const dataRange = logsVolumeData && logsVolumeData.data[0] && logsVolumeData.data[0].meta?.custom?.absoluteRange;
  return dataRange ? (selectedTimeRange.from - selectedTimeRange.to) / (dataRange.from - dataRange.to) : undefined;
}

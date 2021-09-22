import { AbsoluteTimeRange, DataQueryResponse, LoadingState, SplitOpen, TimeZone } from '@grafana/data';
import { Button, Collapse, InlineField, InlineFieldRow, InlineSwitch, useTheme2 } from '@grafana/ui';
import { ExploreGraph } from './ExploreGraph';
import React, { useCallback } from 'react';
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
  autoLoadLogsVolume: boolean;
  onChangeAutoLogsVolume: (value: boolean) => void;
};

export function LogsVolumePanel(props: Props) {
  const {
    width,
    logsVolumeData,
    exploreId,
    loadLogsVolumeData,
    absoluteRange,
    timeZone,
    splitOpen,
    onUpdateTimeRange,
    autoLoadLogsVolume,
    onChangeAutoLogsVolume,
  } = props;
  const theme = useTheme2();
  const spacing = parseInt(theme.spacing(2).slice(0, -2), 10);
  const height = 150;

  let LogsVolumePanelContent;

  if (!logsVolumeData) {
    LogsVolumePanelContent = (
      <Button
        onClick={() => {
          loadLogsVolumeData(exploreId);
        }}
      >
        Load logs volume
      </Button>
    );
  } else if (logsVolumeData?.error) {
    LogsVolumePanelContent = (
      <span>
        Failed to load volume logs for this query:{' '}
        {logsVolumeData.error.data?.message || logsVolumeData.error.statusText}
      </span>
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

  const handleOnChangeAutoLogsVolume = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const { target } = event;
      if (target) {
        onChangeAutoLogsVolume(target.checked);
      }
    },
    [onChangeAutoLogsVolume]
  );

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
        })}
      >
        <InlineFieldRow>
          <InlineField label="Auto-load logs volume" transparent>
            <InlineSwitch value={autoLoadLogsVolume} onChange={handleOnChangeAutoLogsVolume} transparent />
          </InlineField>
        </InlineFieldRow>
      </div>
    </Collapse>
  );
}

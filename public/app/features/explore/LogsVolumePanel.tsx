import { AbsoluteTimeRange, DataQueryResponse, LoadingState, SplitOpen, TimeZone } from '@grafana/data';
import { Button, Collapse, useTheme2 } from '@grafana/ui';
import { ExploreGraph } from './ExploreGraph';
import React from 'react';
import { ExploreId } from '../../types';

type Props = {
  exploreId: ExploreId;
  loadLogsVolumeData: (exploreId: ExploreId) => void;
  logsVolumeData?: DataQueryResponse;
  absoluteRange: AbsoluteTimeRange;
  timeZone: TimeZone;
  splitOpen: SplitOpen;
  width: number;
  onUpdateTimeRange: (timeRange: AbsoluteTimeRange) => void;
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
  } = props;
  const theme = useTheme2();
  const spacing = parseInt(theme.spacing(2).slice(0, -2), 10);

  let LogsVolumePanelContent;

  if (!logsVolumeData) {
    LogsVolumePanelContent = (
      <LogsVolumeContentWrapper>
        <Button
          onClick={() => {
            loadLogsVolumeData(exploreId);
          }}
        >
          Load logs volume
        </Button>
      </LogsVolumeContentWrapper>
    );
  } else if (logsVolumeData?.error) {
    LogsVolumePanelContent = (
      <LogsVolumeContentWrapper>
        Failed to load volume logs for this query:{' '}
        {logsVolumeData.error.data?.message || logsVolumeData.error.statusText}
      </LogsVolumeContentWrapper>
    );
  } else if (logsVolumeData?.state === LoadingState.Loading) {
    LogsVolumePanelContent = <LogsVolumeContentWrapper>Logs volume is loading...</LogsVolumeContentWrapper>;
  } else if (logsVolumeData?.data) {
    if (logsVolumeData.data.length > 0) {
      LogsVolumePanelContent = (
        <ExploreGraph
          loadingState={LoadingState.Done}
          data={logsVolumeData.data}
          height={150}
          width={width - spacing}
          absoluteRange={absoluteRange}
          onChangeTime={onUpdateTimeRange}
          timeZone={timeZone}
          splitOpenFn={splitOpen}
        />
      );
    } else {
      LogsVolumePanelContent = <LogsVolumeContentWrapper>No volume data.</LogsVolumeContentWrapper>;
    }
  }

  return (
    <Collapse label="Logs volume" isOpen={true} loading={logsVolumeData?.state === LoadingState.Loading}>
      {LogsVolumePanelContent}
    </Collapse>
  );
}

function LogsVolumeContentWrapper({ children }: { children: React.ReactNode }) {
  return <div style={{ height: '150px', textAlign: 'center', paddingTop: '50px' }}>{children}</div>;
}

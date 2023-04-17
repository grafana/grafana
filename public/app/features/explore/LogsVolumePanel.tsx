import { css } from '@emotion/css';
import { identity } from 'lodash';
import React from 'react';

import {
  AbsoluteTimeRange,
  DataQueryResponse,
  LoadingState,
  SplitOpen,
  TimeZone,
  EventBus,
  GrafanaTheme2,
} from '@grafana/data';
import { Icon, Tooltip, TooltipDisplayMode, useStyles2, useTheme2 } from '@grafana/ui';

import { getLogsVolumeDataSourceInfo, isLogsVolumeLimited } from '../logs/utils';

import { ExploreGraph } from './Graph/ExploreGraph';

type Props = {
  logsVolumeData: DataQueryResponse | undefined;
  allLogsVolumeMaximum: number;
  absoluteRange: AbsoluteTimeRange;
  timeZone: TimeZone;
  splitOpen: SplitOpen;
  width: number;
  onUpdateTimeRange: (timeRange: AbsoluteTimeRange) => void;
  onLoadLogsVolume: () => void;
  onHiddenSeriesChanged: (hiddenSeries: string[]) => void;
  eventBus: EventBus;
};

export function LogsVolumePanel(props: Props) {
  const { width, timeZone, splitOpen, onUpdateTimeRange, onHiddenSeriesChanged, allLogsVolumeMaximum } = props;
  const theme = useTheme2();
  const styles = useStyles2(getStyles);
  const spacing = parseInt(theme.spacing(2).slice(0, -2), 10);
  const height = 150;

  if (props.logsVolumeData === undefined) {
    return null;
  }

  const logsVolumeData = props.logsVolumeData;

  const logsVolumeInfo = getLogsVolumeDataSourceInfo(logsVolumeData?.data);
  let extraInfo = logsVolumeInfo ? `${logsVolumeInfo.name}` : '';

  if (isLogsVolumeLimited(logsVolumeData.data)) {
    extraInfo = [
      extraInfo,
      'This datasource does not support full-range histograms. The graph below is based on the logs seen in the response.',
    ]
      .filter(identity)
      .join('. ');
  }

  let LogsVolumePanelContent;

  if (logsVolumeData?.data) {
    if (logsVolumeData.data.length > 0) {
      LogsVolumePanelContent = (
        <ExploreGraph
          graphStyle="lines"
          loadingState={logsVolumeData.state ?? LoadingState.Done}
          data={logsVolumeData.data}
          height={height}
          width={width - spacing * 2}
          absoluteRange={props.absoluteRange}
          onChangeTime={onUpdateTimeRange}
          timeZone={timeZone}
          splitOpenFn={splitOpen}
          tooltipDisplayMode={TooltipDisplayMode.Multi}
          onHiddenSeriesChanged={onHiddenSeriesChanged}
          anchorToZero
          yAxisMaximum={allLogsVolumeMaximum}
          eventBus={props.eventBus}
        />
      );
    } else {
      LogsVolumePanelContent = <span>No volume data.</span>;
    }
  }

  let extraInfoComponent = <span>{extraInfo}</span>;

  if (logsVolumeData.state === LoadingState.Streaming) {
    extraInfoComponent = (
      <>
        {extraInfoComponent}
        <Tooltip content="Streaming">
          <Icon name="circle-mono" size="md" className={styles.streaming} data-testid="logs-volume-streaming" />
        </Tooltip>
      </>
    );
  }

  return (
    <div style={{ height }} className={styles.contentContainer}>
      {LogsVolumePanelContent}
      {extraInfoComponent && <div className={styles.extraInfoContainer}>{extraInfoComponent}</div>}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    extraInfoContainer: css`
      display: flex;
      justify-content: end;
      position: absolute;
      right: 5px;
      top: -10px;
      font-size: ${theme.typography.bodySmall.fontSize};
      color: ${theme.colors.text.secondary};
    `,
    contentContainer: css`
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
    `,
    streaming: css`
      color: ${theme.colors.success.text};
    `,
  };
};

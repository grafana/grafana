import { css } from '@emotion/css';
import { identity } from 'lodash';
import * as React from 'react';

import {
  AbsoluteTimeRange,
  DataQueryResponse,
  LoadingState,
  SplitOpen,
  EventBus,
  GrafanaTheme2,
  DataFrame,
  TimeRange,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { TimeZone } from '@grafana/schema';
import { Icon, SeriesVisibilityChangeMode, Tooltip, TooltipDisplayMode, useStyles2, useTheme2 } from '@grafana/ui';

import { getLogsVolumeDataSourceInfo, isLogsVolumeLimited } from '../../logs/utils';
import { ExploreGraph } from '../Graph/ExploreGraph';

type Props = {
  logsVolumeData: DataQueryResponse;
  allLogsVolumeMaximum: number;
  timeRange: TimeRange;
  timeZone: TimeZone;
  splitOpen: SplitOpen;
  width: number;
  onUpdateTimeRange: (timeRange: AbsoluteTimeRange) => void;
  onLoadLogsVolume: () => void;
  onHiddenSeriesChanged: (hiddenSeries: string[]) => void;
  eventBus: EventBus;
  annotations: DataFrame[];
  toggleLegendRef?:
    | React.MutableRefObject<(name: string | undefined, mode: SeriesVisibilityChangeMode) => void>
    | undefined;
};

export function LogsVolumePanel(props: Props) {
  const {
    width,
    timeZone,
    splitOpen,
    onUpdateTimeRange,
    onHiddenSeriesChanged,
    allLogsVolumeMaximum,
    toggleLegendRef,
  } = props;
  const theme = useTheme2();
  const styles = useStyles2(getStyles);

  const spacing = parseInt(theme.spacing(2).slice(0, -2), 10);
  const height = 150;

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

  let extraInfoComponent = <span>{extraInfo}</span>;

  if (logsVolumeData.state === LoadingState.Streaming) {
    extraInfoComponent = (
      <>
        {extraInfoComponent}
        <Tooltip content={t('explore.logs-volume-panel.content-streaming', 'Streaming')}>
          <Icon name="circle-mono" size="md" className={styles.streaming} data-testid="logs-volume-streaming" />
        </Tooltip>
      </>
    );
  }

  return (
    <div style={{ height }} className={styles.contentContainer}>
      <ExploreGraph
        toggleLegendRef={toggleLegendRef}
        vizLegendOverrides={{
          calcs: ['sum'],
        }}
        graphStyle="lines"
        loadingState={logsVolumeData.state ?? LoadingState.Done}
        data={logsVolumeData.data}
        height={height}
        width={width - spacing * 2}
        timeRange={props.timeRange}
        onChangeTime={onUpdateTimeRange}
        timeZone={timeZone}
        splitOpenFn={splitOpen}
        tooltipDisplayMode={TooltipDisplayMode.Multi}
        onHiddenSeriesChanged={onHiddenSeriesChanged}
        anchorToZero
        yAxisMaximum={allLogsVolumeMaximum}
        eventBus={props.eventBus}
        annotations={props.annotations}
      />
      {extraInfoComponent && <div className={styles.extraInfoContainer}>{extraInfoComponent}</div>}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    extraInfoContainer: css({
      display: 'flex',
      justifyContent: 'end',
      position: 'absolute',
      right: '5px',
      top: '-10px',
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.secondary,
    }),
    contentContainer: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    }),
    streaming: css({
      color: theme.colors.success.text,
    }),
  };
};

import { css } from '@emotion/css';
import React, { useState } from 'react';

import {
  AbsoluteTimeRange,
  DataQueryError,
  DataQueryResponse,
  GrafanaTheme2,
  LoadingState,
  SplitOpen,
  TimeZone,
} from '@grafana/data';
import { Alert, Button, Collapse, InlineField, TooltipDisplayMode, useStyles2, useTheme2 } from '@grafana/ui';

import { ExploreGraph } from './ExploreGraph';

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
};

const SHORT_ERROR_MESSAGE_LIMIT = 100;

function ErrorAlert(props: { error: DataQueryError }) {
  const [isOpen, setIsOpen] = useState(false);
  // generic get-error-message-logic, taken from
  // /public/app/features/explore/ErrorContainer.tsx
  const message = props.error.message || props.error.data?.message || '';

  const showButton = !isOpen && message.length > SHORT_ERROR_MESSAGE_LIMIT;

  return (
    <Alert title="Failed to load log volume for this query" severity="warning">
      {showButton ? (
        <Button
          variant="secondary"
          size="xs"
          onClick={() => {
            setIsOpen(true);
          }}
        >
          Show details
        </Button>
      ) : (
        message
      )}
    </Alert>
  );
}

function createVisualisationData(
  logLinesBased: DataQueryResponse | undefined,
  logLinesBasedVisibleRange: AbsoluteTimeRange | undefined,
  fullRangeData: DataQueryResponse | undefined,
  absoluteRange: AbsoluteTimeRange
):
  | {
      logsVolumeData: DataQueryResponse;
      fullRangeData: boolean;
      range: AbsoluteTimeRange;
    }
  | undefined {
  if (fullRangeData !== undefined) {
    return {
      logsVolumeData: fullRangeData,
      fullRangeData: true,
      range: absoluteRange,
    };
  }

  if (logLinesBased !== undefined) {
    return {
      logsVolumeData: logLinesBased,
      fullRangeData: false,
      range: logLinesBasedVisibleRange || absoluteRange,
    };
  }

  return undefined;
}

export function LogsVolumePanel(props: Props) {
  const { width, timeZone, splitOpen, onUpdateTimeRange, onLoadLogsVolume, onHiddenSeriesChanged } = props;
  const theme = useTheme2();
  const styles = useStyles2(getStyles);
  const spacing = parseInt(theme.spacing(2).slice(0, -2), 10);
  const height = 150;

  const data = createVisualisationData(
    props.logLinesBasedData,
    props.logLinesBasedDataVisibleRange,
    props.logsVolumeData,
    props.absoluteRange
  );

  if (data === undefined) {
    return null;
  }

  const { logsVolumeData, fullRangeData, range } = data;

  if (logsVolumeData.error !== undefined) {
    return <ErrorAlert error={logsVolumeData.error} />;
  }

  let LogsVolumePanelContent;

  if (logsVolumeData?.state === LoadingState.Loading) {
    LogsVolumePanelContent = <span>Log volume is loading...</span>;
  } else if (logsVolumeData?.data) {
    if (logsVolumeData.data.length > 0) {
      LogsVolumePanelContent = (
        <ExploreGraph
          graphStyle="lines"
          loadingState={LoadingState.Done}
          data={logsVolumeData.data}
          height={height}
          width={width - spacing}
          absoluteRange={range}
          onChangeTime={onUpdateTimeRange}
          timeZone={timeZone}
          splitOpenFn={splitOpen}
          tooltipDisplayMode={TooltipDisplayMode.Multi}
          onHiddenSeriesChanged={onHiddenSeriesChanged}
        />
      );
    } else {
      LogsVolumePanelContent = <span>No volume data.</span>;
    }
  }

  let extraInfo;
  if (fullRangeData) {
    const zoomRatio = logsLevelZoomRatio(logsVolumeData, range);

    if (zoomRatio !== undefined && zoomRatio < 1) {
      extraInfo = (
        <InlineField label="Reload log volume" transparent>
          <Button size="xs" icon="sync" variant="secondary" onClick={onLoadLogsVolume} id="reload-volume" />
        </InlineField>
      );
    }
  } else {
    extraInfo = (
      <div className={styles.oldInfoText}>
        This datasource does not support full-range histograms. The graph is based on the logs seen in the response.
      </div>
    );
  }
  return (
    <Collapse label="" isOpen={true}>
      <div style={{ height }} className={styles.contentContainer}>
        {LogsVolumePanelContent}
      </div>
      <div className={styles.extraInfoContainer}>{extraInfo}</div>
    </Collapse>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    extraInfoContainer: css`
      display: flex;
      justify-content: end;
      position: absolute;
      right: 5px;
      top: 5px;
    `,
    contentContainer: css`
      display: flex;
      align-items: center;
      justify-content: center;
    `,
    oldInfoText: css`
      font-size: ${theme.typography.size.sm};
      color: ${theme.colors.text.secondary};
    `,
  };
};

function logsLevelZoomRatio(
  logsVolumeData: DataQueryResponse | undefined,
  selectedTimeRange: AbsoluteTimeRange
): number | undefined {
  const dataRange = logsVolumeData && logsVolumeData.data[0] && logsVolumeData.data[0].meta?.custom?.absoluteRange;
  return dataRange ? (selectedTimeRange.from - selectedTimeRange.to) / (dataRange.from - dataRange.to) : undefined;
}

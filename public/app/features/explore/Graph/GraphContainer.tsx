import { css } from '@emotion/css';
import React, { useCallback, useState } from 'react';

import {
  DataFrame,
  EventBus,
  AbsoluteTimeRange,
  TimeZone,
  SplitOpen,
  LoadingState,
  ThresholdsConfig,
  GrafanaTheme2,
} from '@grafana/data';
import {
  GraphThresholdsStyleConfig,
  PanelChrome,
  PanelChromeProps,
  Icon,
  Button,
  useStyles2,
  Tooltip,
} from '@grafana/ui';
import { ExploreGraphStyle } from 'app/types';

import { storeGraphStyle } from '../state/utils';

import { ExploreGraph, MAX_NUMBER_OF_TIME_SERIES } from './ExploreGraph';
import { ExploreGraphLabel } from './ExploreGraphLabel';
import { loadGraphStyle } from './utils';

interface Props extends Pick<PanelChromeProps, 'statusMessage'> {
  width: number;
  height: number;
  data: DataFrame[];
  annotations?: DataFrame[];
  eventBus: EventBus;
  absoluteRange: AbsoluteTimeRange;
  timeZone: TimeZone;
  onChangeTime: (absoluteRange: AbsoluteTimeRange) => void;
  splitOpenFn: SplitOpen;
  loadingState: LoadingState;
  thresholdsConfig?: ThresholdsConfig;
  thresholdsStyle?: GraphThresholdsStyleConfig;
}

export const GraphContainer = ({
  data,
  eventBus,
  height,
  width,
  absoluteRange,
  timeZone,
  annotations,
  onChangeTime,
  splitOpenFn,
  thresholdsConfig,
  thresholdsStyle,
  loadingState,
  statusMessage,
}: Props) => {
  const [showAllTimeSeries, setShowAllTimeSeries] = useState(false);
  const [graphStyle, setGraphStyle] = useState(loadGraphStyle);
  const styles = useStyles2(getStyles);

  const onGraphStyleChange = useCallback((graphStyle: ExploreGraphStyle) => {
    storeGraphStyle(graphStyle);
    setGraphStyle(graphStyle);
  }, []);

  return (
    <PanelChrome
      title="Graph"
      titleItems={[
        MAX_NUMBER_OF_TIME_SERIES < data.length && !showAllTimeSeries && (
          <div key="disclaimer" className={styles.timeSeriesDisclaimer}>
            <Tooltip content={`Showing only ${MAX_NUMBER_OF_TIME_SERIES} time series`}>
              <Icon className={styles.disclaimerIcon} name="exclamation-triangle" />
            </Tooltip>
            <Button variant="secondary" size="sm" onClick={() => setShowAllTimeSeries(true)}>
              Show all {data.length} series
            </Button>
          </div>
        ),
      ].filter(Boolean)}
      width={width}
      height={height}
      loadingState={loadingState}
      statusMessage={statusMessage}
      actions={<ExploreGraphLabel graphStyle={graphStyle} onChangeGraphStyle={onGraphStyleChange} />}
    >
      {(innerWidth, innerHeight) => (
        <ExploreGraph
          graphStyle={graphStyle}
          data={data}
          height={innerHeight}
          width={innerWidth}
          absoluteRange={absoluteRange}
          onChangeTime={onChangeTime}
          timeZone={timeZone}
          annotations={annotations}
          splitOpenFn={splitOpenFn}
          loadingState={loadingState}
          thresholdsConfig={thresholdsConfig}
          thresholdsStyle={thresholdsStyle}
          eventBus={eventBus}
          showAllTimeSeries={showAllTimeSeries}
        />
      )}
    </PanelChrome>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  timeSeriesDisclaimer: css({
    label: 'time-series-disclaimer',
    textSlign: 'center',
    fontSize: theme.typography.bodySmall.fontSize,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  }),
  disclaimerIcon: css({
    label: 'disclaimer-icon',
    color: theme.colors.warning.main,
  }),
});

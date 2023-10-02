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

import { ExploreGraph } from './ExploreGraph';
import { ExploreGraphLabel } from './ExploreGraphLabel';
import { loadGraphStyle } from './utils';

const MAX_NUMBER_OF_TIME_SERIES = 20;

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
  const [seriesLimit, setSeriesLimit] = useState<number | undefined>(MAX_NUMBER_OF_TIME_SERIES);
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
        seriesLimit && seriesLimit < data.length && (
          <div key="disclaimer" className={styles.timeSeriesDisclaimer}>
            <Tooltip content={`Showing only ${seriesLimit} time series`}>
              <Icon className={styles.disclaimerIcon} name="exclamation-triangle" />
            </Tooltip>
            <Button variant="secondary" size="sm" onClick={() => setSeriesLimit(undefined)}>
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
          limit={seriesLimit}
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

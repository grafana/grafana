import { css } from '@emotion/css';
import React, { useCallback, useMemo, useState } from 'react';
import { useToggle } from 'react-use';

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
import { t, Trans } from 'app/core/internationalization';
import { ExploreGraphStyle } from 'app/types';

import { storeGraphStyle } from '../state/utils';

import { ExploreGraph } from './ExploreGraph';
import { ExploreGraphLabel } from './ExploreGraphLabel';
import { loadGraphStyle } from './utils';

let MAX_NUMBER_OF_TIME_SERIES = 20; // LOGZ.IO GRAFANA CHANGE

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
  const [showAllSeries, toggleShowAllSeries] = useToggle(false);
  const [graphStyle, setGraphStyle] = useState(loadGraphStyle);
  const styles = useStyles2(getStyles);
  // LOGZ.IO GRAFANA CHANGE :: make the max number of time series bigger by FF. requested by rrk
  const showMoreTimeSeries = (window as any).logzio?.configs?.featureFlags?.MaxNumberOfTimeSeriesBigger;
  MAX_NUMBER_OF_TIME_SERIES = showMoreTimeSeries ? 500 : 20;

  const onGraphStyleChange = useCallback((graphStyle: ExploreGraphStyle) => {
    storeGraphStyle(graphStyle);
    setGraphStyle(graphStyle);
  }, []);

  const slicedData = useMemo(() => {
    return showAllSeries ? data : data.slice(0, MAX_NUMBER_OF_TIME_SERIES);
  }, [data, showAllSeries]);

  return (
    <PanelChrome
      title={t('graph.container.title', 'Graph')}
      titleItems={[
        !showAllSeries && MAX_NUMBER_OF_TIME_SERIES < data.length && (
          <div key="disclaimer" className={styles.timeSeriesDisclaimer}>
            <span className={styles.warningMessage}>
              <Icon name="exclamation-triangle" aria-hidden="true" />
              <Trans i18nKey={'graph.container.show-only-series'}>
                Showing only {{ MAX_NUMBER_OF_TIME_SERIES }} series
              </Trans>
            </span>
            <Tooltip
              content={t(
                'graph.container.content',
                'Rendering too many series in a single panel may impact performance and make data harder to read. Consider refining your queries.'
              )}
            >
              <Button variant="secondary" size="sm" onClick={toggleShowAllSeries}>
                <Trans i18nKey={'graph.container.show-all-series'}>Show all {{ length: data.length }}</Trans>
              </Button>
            </Tooltip>
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
          data={slicedData}
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
        />
      )}
    </PanelChrome>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  timeSeriesDisclaimer: css({
    label: 'time-series-disclaimer',
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  }),
  warningMessage: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    color: theme.colors.warning.main,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
});

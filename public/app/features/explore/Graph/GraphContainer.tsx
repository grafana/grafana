import { useCallback, useMemo, useState } from 'react';
import { useToggle } from 'react-use';

import {
  DataFrame,
  EventBus,
  AbsoluteTimeRange,
  TimeZone,
  SplitOpen,
  LoadingState,
  ThresholdsConfig,
  TimeRange,
} from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { GraphThresholdsStyleConfig, PanelChrome, PanelChromeProps } from '@grafana/ui';
import { ExploreGraphStyle } from 'app/types/explore';

import { LimitedDataDisclaimer } from '../LimitedDataDisclaimer';
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
  timeRange: TimeRange;
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
  timeRange,
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
          <LimitedDataDisclaimer
            key="disclaimer"
            toggleShowAllSeries={toggleShowAllSeries}
            info={
              <Trans i18nKey={'graph.container.show-only-series'}>
                Showing only {{ MAX_NUMBER_OF_TIME_SERIES }} series
              </Trans>
            }
            buttonLabel={<Trans i18nKey={'graph.container.show-all-series'}>Show all {{ length: data.length }}</Trans>}
            tooltip={t(
              'graph.container.content',
              'Rendering too many series in a single panel may impact performance and make data harder to read. Consider refining your queries.'
            )}
          />
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
          timeRange={timeRange}
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

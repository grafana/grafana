import { css } from '@emotion/css';
import { ReactNode, useCallback, useMemo, useState } from 'react';
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
  TimeRange,
  ThresholdsMode, RawTimeRange,
} from '@grafana/data';
import {
  GraphThresholdsStyleConfig,
  PanelChrome,
  PanelChromeProps,
  Icon,
  Button,
  useStyles2,
  Tooltip,
  GraphThresholdsStyleMode,
} from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';
import { ExploreGraphStyle, ExploreTimeRangeOptions } from 'app/types';

import { storeGraphStyle } from '../state/utils';

import { ExploreGraph } from './ExploreGraph';
import { ExploreGraphLabel } from './ExploreGraphLabel';
import { ExploreGraphTimeSelector } from "./ExploreTimeSelector";
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
  updateTimeRange?: (rawRange: RawTimeRange) => void;
  onChangeTime: (absoluteRange: AbsoluteTimeRange) => void;
  splitOpenFn: SplitOpen;
  loadingState: LoadingState;
  thresholdsConfig?: ThresholdsConfig;
  thresholdsStyle?: GraphThresholdsStyleConfig;
  warnThreshold?: number;
  criticalThreshold?: number;
  queryBuilderOnly?: boolean;
  hideQueryEditor?: boolean;
  hideMiniOptions?: boolean;
  title?: string;
}

export const GraphContainer = ({
  title,
  data,
  eventBus,
  height,
  width,
  timeRange,
  timeZone,
  annotations,
  updateTimeRange,
  onChangeTime,
  splitOpenFn,
  thresholdsConfig,
  thresholdsStyle,
  loadingState,
  statusMessage,
  warnThreshold,
  criticalThreshold,
  queryBuilderOnly,
  hideQueryEditor,
  hideMiniOptions,
}: Props) => {
  const [showAllSeries, toggleShowAllSeries] = useToggle(false);
  const [graphStyle, setGraphStyle] = useState(loadGraphStyle);
  const [timeRangeOption, setTimeRangeOption] = useState<ExploreTimeRangeOptions>('24h');
  const styles = useStyles2(getStyles);

  const onGraphStyleChange = useCallback((graphStyle: ExploreGraphStyle) => {
    storeGraphStyle(graphStyle);
    setGraphStyle(graphStyle);
  }, []);

  const slicedData = useMemo(() => {
    return showAllSeries ? data : data.slice(0, MAX_NUMBER_OF_TIME_SERIES);
  }, [data, showAllSeries]);

  if (criticalThreshold || warnThreshold) {
    thresholdsStyle = {
      mode: GraphThresholdsStyleMode.Dashed,
    }

    let steps = [
      { value: 0, color: 'green', state: 'ok' },
    ];
    if (warnThreshold) {
      steps.push({ value: warnThreshold, color: 'yellow', state: 'warning' });
    }
    if (criticalThreshold) {
      steps.push({ value: criticalThreshold, color: 'red', state: 'critical' });
    }
    thresholdsConfig = {
      steps: steps,
      mode: ThresholdsMode.Absolute,
    };
  }

  const onTimeRangeChange = useCallback((timeRange: ExploreTimeRangeOptions) => {
    if (!updateTimeRange) {
      return;
    }

    updateTimeRange({ from: 'now-' + timeRange, to: 'now' });
    setTimeRangeOption(timeRange);
  }, [updateTimeRange]);

  let actions: ReactNode = null;
  if (!hideMiniOptions) {
    if (queryBuilderOnly && hideQueryEditor) {
      actions = <ExploreGraphTimeSelector timeRange={timeRangeOption} onChangeTimeRange={onTimeRangeChange} />
    } else {
      actions = <ExploreGraphLabel graphStyle={graphStyle} onChangeGraphStyle={onGraphStyleChange} />
    }
  }

  return (
    <PanelChrome
      title={title ? title : queryBuilderOnly ? '' : t('graph.container.title', 'Graph')}
      hideHeader={!title && queryBuilderOnly && hideQueryEditor && hideMiniOptions}
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
        (queryBuilderOnly && (showAllSeries || MAX_NUMBER_OF_TIME_SERIES >= data.length)) && data.length > 0 && (
          <div key="series-count" className={styles.seriesCount}>
            {t('graph.container.series-count', '{{count}} series', { count: data.length })}
          </div>
        ),
      ].filter(Boolean)}
      width={width}
      height={height}
      loadingState={loadingState}
      statusMessage={statusMessage}
      actions={actions}
    >
      {(innerWidth, innerHeight) => (
        <ExploreGraph
          graphStyle={queryBuilderOnly ? 'lines' : graphStyle}
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
  seriesCount: css({
    label: 'series-count',
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.secondary,
    display: 'flex',
    alignItems: 'center',
  }),
});

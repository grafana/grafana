import { css } from '@emotion/css';
import AutoSizer from 'react-virtualized-auto-sizer';

import { GrafanaTheme2, PanelData, ThresholdsConfig, isTimeSeriesFrames } from '@grafana/data';
import { GraphThresholdsStyleMode } from '@grafana/schema';
import { useStyles2 } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { GraphContainer } from 'app/features/explore/Graph/GraphContainer';

import { ExpressionResult } from '../expressions/Expression';

import { getStatusMessage } from './util';

interface Props {
  data: PanelData;
  thresholds?: ThresholdsConfig;
  thresholdsType?: GraphThresholdsStyleMode;
}

/** The VizWrapper is just a simple component that renders either a table or a graph based on the type of data we receive from "PanelData" */
export const VizWrapper = ({ data, thresholds, thresholdsType }: Props) => {
  const styles = useStyles2(getStyles);
  const isTimeSeriesData = isTimeSeriesFrames(data.series);
  const statusMessage = getStatusMessage(data);
  const thresholdsStyle = thresholdsType ? { mode: thresholdsType } : undefined;

  return (
    <div className={styles.wrapper}>
      <AutoSizer disableHeight>
        {({ width }) => (
          <div style={{ width }}>
            {isTimeSeriesData ? (
              <GraphContainer
                statusMessage={statusMessage}
                data={data.series}
                eventBus={appEvents}
                height={300}
                width={width}
                timeRange={data.timeRange}
                timeZone="browser"
                onChangeTime={() => {}}
                splitOpenFn={() => {}}
                loadingState={data.state}
                thresholdsConfig={thresholds}
                thresholdsStyle={thresholdsStyle}
              />
            ) : (
              <div className={styles.instantVectorResultWrapper}>
                <header className={styles.title}>Table</header>
                <ExpressionResult series={data.series} />
              </div>
            )}
          </div>
        )}
      </AutoSizer>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    width: '100%',
    position: 'relative',
  }),
  instantVectorResultWrapper: css({
    border: `solid 1px ${theme.colors.border.medium}`,
    borderRadius: theme.shape.radius.default,
    padding: 0,

    display: 'flex',
    flexDirection: 'column',
    flexWrap: 'nowrap',
  }),
  title: css({
    label: 'panel-title',
    padding: theme.spacing(),
    textOverflow: 'ellipsis',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    fontSize: theme.typography.h6.fontSize,
    fontWeight: theme.typography.h6.fontWeight,
  }),
});

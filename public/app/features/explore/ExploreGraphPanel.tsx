import React, { PureComponent } from 'react';
import { css, cx } from 'emotion';
import { GrafanaTheme, TimeZone, AbsoluteTimeRange, GraphSeriesXY, dateTime } from '@grafana/data';

import {
  selectThemeVariant,
  Themeable,
  GraphWithLegend,
  LegendDisplayMode,
  withTheme,
  Collapse,
  GraphSeriesToggler,
  GraphSeriesTogglerAPI,
  Chart,
  Icon,
} from '@grafana/ui';

const MAX_NUMBER_OF_TIME_SERIES = 20;

const getStyles = (theme: GrafanaTheme) => ({
  timeSeriesDisclaimer: css`
    label: time-series-disclaimer;
    width: 300px;
    margin: ${theme.spacing.sm} auto;
    padding: 10px 0;
    border-radius: ${theme.border.radius.md};
    text-align: center;
    background-color: ${selectThemeVariant({ light: theme.palette.white, dark: theme.palette.dark4 }, theme.type)};
  `,
  disclaimerIcon: css`
    label: disclaimer-icon;
    color: ${theme.palette.yellow};
    margin-right: ${theme.spacing.xs};
  `,
  showAllTimeSeries: css`
    label: show-all-time-series;
    cursor: pointer;
    color: ${theme.colors.linkExternal};
  `,
});

interface Props extends Themeable {
  ariaLabel?: string;
  series?: GraphSeriesXY[] | null;
  width: number;
  absoluteRange: AbsoluteTimeRange;
  loading?: boolean;
  showPanel: boolean;
  showBars: boolean;
  showLines: boolean;
  isStacked: boolean;
  timeZone?: TimeZone;
  onUpdateTimeRange: (absoluteRange: AbsoluteTimeRange) => void;
  onHiddenSeriesChanged?: (hiddenSeries: string[]) => void;
}

interface State {
  hiddenSeries: string[];
  showAllTimeSeries: boolean;
}

class UnThemedExploreGraphPanel extends PureComponent<Props, State> {
  state: State = {
    hiddenSeries: [],
    showAllTimeSeries: false,
  };

  onShowAllTimeSeries = () => {
    this.setState({
      showAllTimeSeries: true,
    });
  };

  onChangeTime = (from: number, to: number) => {
    const { onUpdateTimeRange } = this.props;
    onUpdateTimeRange({ from, to });
  };

  renderGraph = () => {
    const {
      ariaLabel,
      width,
      series,
      onHiddenSeriesChanged,
      timeZone,
      absoluteRange,
      showPanel,
      showBars,
      showLines,
      isStacked,
    } = this.props;
    const { showAllTimeSeries } = this.state;

    if (!series) {
      return null;
    }

    const timeRange = {
      from: dateTime(absoluteRange.from),
      to: dateTime(absoluteRange.to),
      raw: {
        from: dateTime(absoluteRange.from),
        to: dateTime(absoluteRange.to),
      },
    };

    const height = showPanel ? 200 : 100;
    const lineWidth = showLines ? 1 : 5;
    const seriesToShow = showAllTimeSeries ? series : series.slice(0, MAX_NUMBER_OF_TIME_SERIES);
    return (
      <GraphSeriesToggler series={seriesToShow} onHiddenSeriesChanged={onHiddenSeriesChanged}>
        {({ onSeriesToggle, toggledSeries }: GraphSeriesTogglerAPI) => {
          return (
            <GraphWithLegend
              ariaLabel={ariaLabel}
              displayMode={LegendDisplayMode.List}
              height={height}
              isLegendVisible={true}
              placement={'under'}
              width={width}
              timeRange={timeRange}
              timeZone={timeZone}
              showBars={showBars}
              showLines={showLines}
              showPoints={false}
              onToggleSort={() => {}}
              series={toggledSeries}
              isStacked={isStacked}
              lineWidth={lineWidth}
              onSeriesToggle={onSeriesToggle}
              onHorizontalRegionSelected={this.onChangeTime}
            >
              {/* For logs we are using mulit mode until we refactor logs histogram to use barWidth instead of lineWidth to render bars */}
              <Chart.Tooltip mode={showBars ? 'multi' : 'single'} />
            </GraphWithLegend>
          );
        }}
      </GraphSeriesToggler>
    );
  };

  render() {
    const { series, showPanel, loading, theme } = this.props;
    const { showAllTimeSeries } = this.state;
    const style = getStyles(theme);

    return (
      <>
        {series && series.length > MAX_NUMBER_OF_TIME_SERIES && !showAllTimeSeries && (
          <div className={cx([style.timeSeriesDisclaimer])}>
            <Icon className={style.disclaimerIcon} name="exclamation-triangle" />
            {`Showing only ${MAX_NUMBER_OF_TIME_SERIES} time series. `}
            <span
              className={cx([style.showAllTimeSeries])}
              onClick={this.onShowAllTimeSeries}
            >{`Show all ${series.length}`}</span>
          </div>
        )}

        {showPanel && (
          <Collapse label="Graph" loading={loading} isOpen>
            {this.renderGraph()}
          </Collapse>
        )}

        {!showPanel && this.renderGraph()}
      </>
    );
  }
}

export const ExploreGraphPanel = withTheme(UnThemedExploreGraphPanel);
ExploreGraphPanel.displayName = 'ExploreGraphPanel';

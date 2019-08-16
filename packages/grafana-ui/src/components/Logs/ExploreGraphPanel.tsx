import React, { PureComponent } from 'react';

import { TimeZone, AbsoluteTimeRange, GraphSeriesXY, dateTimeForTimeZone } from '@grafana/data';
import { GraphSeriesToggler, GraphSeriesTogglerAPI } from '../Graph/GraphSeriesToggler';
import { GraphWithLegend } from '../Graph/GraphWithLegend';
import { LegendDisplayMode } from '../Legend/Legend';
import { Panel } from '../Panel/Panel';

const MAX_NUMBER_OF_TIME_SERIES = 20;

interface Props {
  series: GraphSeriesXY[];
  width: number;
  absoluteRange: AbsoluteTimeRange;
  loading: boolean;
  showPanel: boolean;
  showBars: boolean;
  showLines: boolean;
  isStacked: boolean;
  showingGraph: boolean;
  showingTable: boolean;
  timeZone: TimeZone;
  onUpdateTimeRange: (absoluteRange: AbsoluteTimeRange) => void;
  onToggleGraph?: (showingGraph: boolean) => void;
  onHiddenSeriesChanged?: (hiddenSeries: string[]) => void;
}

interface State {
  hiddenSeries: string[];
  showAllTimeSeries: boolean;
}

export class ExploreGraphPanel extends PureComponent<Props, State> {
  state: State = {
    hiddenSeries: [],
    showAllTimeSeries: false,
  };

  onShowAllTimeSeries = () => {
    this.setState({
      showAllTimeSeries: true,
    });
  };

  onClickGraphButton = () => {
    const { onToggleGraph, showingGraph } = this.props;
    if (onToggleGraph) {
      onToggleGraph(showingGraph);
    }
  };

  onChangeTime = (absoluteRange: AbsoluteTimeRange) => {
    const { onUpdateTimeRange } = this.props;
    onUpdateTimeRange(absoluteRange);
  };

  renderGraph = () => {
    const {
      width,
      series,
      onHiddenSeriesChanged,
      timeZone,
      absoluteRange,
      showPanel,
      showingGraph,
      showingTable,
      showBars,
      showLines,
      isStacked,
    } = this.props;
    const { showAllTimeSeries } = this.state;

    if (!series) {
      return null;
    }

    const timeRange = {
      from: dateTimeForTimeZone(timeZone, absoluteRange.from),
      to: dateTimeForTimeZone(timeZone, absoluteRange.to),
      raw: {
        from: dateTimeForTimeZone(timeZone, absoluteRange.from),
        to: dateTimeForTimeZone(timeZone, absoluteRange.to),
      },
    };
    const height = showPanel === false ? 100 : showingGraph && showingTable ? 200 : 400;
    const lineWidth = showLines ? 1 : 5;
    const seriesToShow = showAllTimeSeries ? series : series.slice(0, MAX_NUMBER_OF_TIME_SERIES);

    return (
      <GraphSeriesToggler series={seriesToShow} onHiddenSeriesChanged={onHiddenSeriesChanged}>
        {({ onSeriesToggle, toggledSeries }: GraphSeriesTogglerAPI) => {
          return (
            <GraphWithLegend
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
              onSelectionChanged={this.onChangeTime}
            />
          );
        }}
      </GraphSeriesToggler>
    );
  };

  render() {
    const { series, showPanel, showingGraph, loading } = this.props;
    const { showAllTimeSeries } = this.state;

    return (
      <>
        {series && series.length > MAX_NUMBER_OF_TIME_SERIES && !showAllTimeSeries && (
          <div className="time-series-disclaimer">
            <i className="fa fa-fw fa-warning disclaimer-icon" />
            {`Showing only ${MAX_NUMBER_OF_TIME_SERIES} time series. `}
            <span className="show-all-time-series" onClick={this.onShowAllTimeSeries}>{`Show all ${
              series.length
            }`}</span>
          </div>
        )}

        {showPanel && (
          <Panel label="Graph" collapsible isOpen={showingGraph} loading={loading} onToggle={this.onClickGraphButton}>
            {this.renderGraph()}
          </Panel>
        )}

        {!showPanel && this.renderGraph()}
      </>
    );
  }
}

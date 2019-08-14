import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import { LegendDisplayMode, GraphWithLegend } from '@grafana/ui';
import { TimeZone, AbsoluteTimeRange, GraphSeriesXY, dateTimeForTimeZone, LoadingState } from '@grafana/data';

import { GraphSeriesToggler } from 'app/plugins/panel/graph2/GraphSeriesToggler';
import Panel from './Panel';
import { StoreState, ExploreId, ExploreMode } from 'app/types';
import { getTimeZone } from '../profile/state/selectors';
import { toggleGraph, updateTimeRange } from './state/actions';

const MAX_NUMBER_OF_TIME_SERIES = 20;

interface Props {
  exploreId: ExploreId;
  series: GraphSeriesXY[];
  width: number;
  absoluteRange?: AbsoluteTimeRange;
  loading?: boolean;
  mode?: ExploreMode;
  showingGraph?: boolean;
  showingTable?: boolean;
  timeZone?: TimeZone;
  onHiddenSeriesChanged?: (hiddenSeries: string[]) => void;
  toggleGraph: typeof toggleGraph;
  updateTimeRange: typeof updateTimeRange;
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
    const { toggleGraph, exploreId, showingGraph } = this.props;
    toggleGraph(exploreId, showingGraph);
  };

  onChangeTime = (absoluteRange: AbsoluteTimeRange) => {
    const { exploreId, updateTimeRange } = this.props;

    updateTimeRange({ exploreId, absoluteRange });
  };

  renderGraph = () => {
    const {
      width,
      series,
      onHiddenSeriesChanged,
      timeZone,
      absoluteRange,
      mode,
      showingGraph,
      showingTable,
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
    const height = mode === ExploreMode.Logs ? 100 : showingGraph && showingTable ? 200 : 400;
    const showBars = mode === ExploreMode.Logs ? true : false;
    const showLines = mode === ExploreMode.Metrics ? true : false;
    const isStacked = mode === ExploreMode.Logs ? true : false;
    const lineWidth = mode === ExploreMode.Metrics ? 1 : 5;
    const seriesToShow = showAllTimeSeries ? series : series.slice(0, MAX_NUMBER_OF_TIME_SERIES);

    return (
      <GraphSeriesToggler series={seriesToShow} onHiddenSeriesChanged={onHiddenSeriesChanged}>
        {({ onSeriesToggle, toggledSeries }) => {
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
    const { series, mode, showingGraph, loading } = this.props;
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

        {mode === ExploreMode.Metrics && (
          <Panel label="Graph" collapsible isOpen={showingGraph} loading={loading} onToggle={this.onClickGraphButton}>
            {this.renderGraph()}
          </Panel>
        )}

        {mode === ExploreMode.Logs && this.renderGraph()}
      </>
    );
  }
}

function mapStateToProps(state: StoreState, { exploreId }: { exploreId: string }) {
  const explore = state.explore;
  // @ts-ignore
  const item: ExploreItemState = explore[exploreId];
  const { loadingState, showingGraph, showingTable, absoluteRange, mode } = item;
  const loading = loadingState === LoadingState.Loading || loadingState === LoadingState.Streaming;

  return {
    loading,
    showingGraph,
    showingTable,
    timeZone: getTimeZone(state.user),
    absoluteRange,
    mode,
  };
}

const mapDispatchToProps = {
  toggleGraph,
  updateTimeRange,
};

export default hot(module)(
  connect(
    mapStateToProps,
    mapDispatchToProps
  )(ExploreGraphPanel)
);

import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import { TimeZone, AbsoluteTimeRange, LoadingState, dateTimeForTimeZone } from '@grafana/data';
import { GraphWithLegend, LegendDisplayMode } from '@grafana/ui';

import { ExploreId, ExploreItemState } from 'app/types/explore';
import { StoreState } from 'app/types';

import { toggleGraph, updateTimeRange } from './state/actions';
import Panel from './Panel';
import { getTimeZone } from '../profile/state/selectors';
import { GraphSeriesToggler } from 'app/plugins/panel/graph2/GraphSeriesToggler';

interface GraphContainerProps {
  exploreId: ExploreId;
  graphResult?: any[];
  loading: boolean;
  absoluteRange: AbsoluteTimeRange;
  timeZone: TimeZone;
  showingGraph: boolean;
  showingTable: boolean;
  split: boolean;
  toggleGraph: typeof toggleGraph;
  updateTimeRange: typeof updateTimeRange;
  width: number;
}

export class GraphContainer extends PureComponent<GraphContainerProps> {
  onClickGraphButton = () => {
    this.props.toggleGraph(this.props.exploreId, this.props.showingGraph);
  };

  onChangeTime = (absoluteRange: AbsoluteTimeRange) => {
    const { exploreId, updateTimeRange } = this.props;

    updateTimeRange({ exploreId, absoluteRange });
  };

  render() {
    const { graphResult, loading, showingGraph, showingTable, absoluteRange, width, timeZone } = this.props;

    if (!graphResult) {
      return null;
    }

    const graphHeight = showingGraph && showingTable ? 200 : 400;
    const timeRange = {
      from: dateTimeForTimeZone(timeZone, absoluteRange.from),
      to: dateTimeForTimeZone(timeZone, absoluteRange.to),
      raw: {
        from: dateTimeForTimeZone(timeZone, absoluteRange.from),
        to: dateTimeForTimeZone(timeZone, absoluteRange.to),
      },
    };

    return (
      <Panel label="Graph" collapsible isOpen={showingGraph} loading={loading} onToggle={this.onClickGraphButton}>
        <GraphSeriesToggler series={graphResult}>
          {({ onSeriesToggle, toggledSeries }) => {
            return (
              <GraphWithLegend
                displayMode={LegendDisplayMode.List}
                height={graphHeight}
                isLegendVisible={true}
                placement={'under'}
                width={width}
                timeRange={timeRange}
                timeZone={timeZone}
                showBars={false}
                showLines={true}
                showPoints={false}
                onSeriesColorChange={() => {}}
                onToggleSort={() => {}}
                series={toggledSeries}
                onSeriesToggle={onSeriesToggle}
                onSelectionChanged={this.onChangeTime}
              />
            );
          }}
        </GraphSeriesToggler>
      </Panel>
    );
  }
}

function mapStateToProps(state: StoreState, { exploreId }: { exploreId: string }) {
  const explore = state.explore;
  const { split } = explore;
  // @ts-ignore
  const item: ExploreItemState = explore[exploreId];
  const { graphResult, loadingState, showingGraph, showingTable, absoluteRange } = item;
  const loading = loadingState === LoadingState.Loading || loadingState === LoadingState.Streaming;
  return {
    graphResult,
    loading,
    showingGraph,
    showingTable,
    split,
    timeZone: getTimeZone(state.user),
    absoluteRange,
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
  )(GraphContainer)
);

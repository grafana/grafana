import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import { TimeZone, AbsoluteTimeRange, LoadingState } from '@grafana/ui';

import { ExploreId, ExploreItemState } from 'app/types/explore';
import { StoreState } from 'app/types';

import { toggleGraph, updateTimeRange } from './state/actions';
import Graph from './Graph';
import Panel from './Panel';
import { getTimeZone } from '../profile/state/selectors';

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
    const {
      exploreId,
      graphResult,
      loading,
      showingGraph,
      showingTable,
      absoluteRange,
      split,
      width,
      timeZone,
    } = this.props;
    const graphHeight = showingGraph && showingTable ? 200 : 400;

    return (
      <Panel label="Graph" collapsible isOpen={showingGraph} loading={loading} onToggle={this.onClickGraphButton}>
        {graphResult && (
          <Graph
            data={graphResult}
            height={graphHeight}
            id={`explore-graph-${exploreId}`}
            onChangeTime={this.onChangeTime}
            range={absoluteRange}
            timeZone={timeZone}
            split={split}
            width={width}
          />
        )}
      </Panel>
    );
  }
}

function mapStateToProps(state: StoreState, { exploreId }) {
  const explore = state.explore;
  const { split } = explore;
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

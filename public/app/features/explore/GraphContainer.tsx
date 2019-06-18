import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import { TimeRange, TimeZone, AbsoluteTimeRange, LoadingState } from '@grafana/ui';

import { ExploreId, ExploreItemState } from 'app/types/explore';
import { StoreState } from 'app/types';

import { toggleGraph, changeTime } from './state/actions';
import Graph from './Graph';
import Panel from './Panel';
import { getTimeZone } from '../profile/state/selectors';
import { toUtc, dateTime } from '@grafana/ui/src/utils/moment_wrapper';

interface GraphContainerProps {
  exploreId: ExploreId;
  graphResult?: any[];
  loading: boolean;
  range: TimeRange;
  timeZone: TimeZone;
  showingGraph: boolean;
  showingTable: boolean;
  split: boolean;
  toggleGraph: typeof toggleGraph;
  changeTime: typeof changeTime;
  width: number;
}

export class GraphContainer extends PureComponent<GraphContainerProps> {
  onClickGraphButton = () => {
    this.props.toggleGraph(this.props.exploreId, this.props.showingGraph);
  };

  onChangeTime = (absRange: AbsoluteTimeRange) => {
    const { exploreId, timeZone, changeTime } = this.props;
    const range = {
      from: timeZone.isUtc ? toUtc(absRange.from) : dateTime(absRange.from),
      to: timeZone.isUtc ? toUtc(absRange.to) : dateTime(absRange.to),
    };

    changeTime(exploreId, range);
  };

  render() {
    const { exploreId, graphResult, loading, showingGraph, showingTable, range, split, width, timeZone } = this.props;
    const graphHeight = showingGraph && showingTable ? 200 : 400;
    const timeRange = { from: range.from.valueOf(), to: range.to.valueOf() };

    return (
      <Panel label="Graph" collapsible isOpen={showingGraph} loading={loading} onToggle={this.onClickGraphButton}>
        {graphResult && (
          <Graph
            data={graphResult}
            height={graphHeight}
            id={`explore-graph-${exploreId}`}
            onChangeTime={this.onChangeTime}
            range={timeRange}
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
  const { graphResult, loadingState, range, showingGraph, showingTable } = item;
  const loading = loadingState === LoadingState.Loading || loadingState === LoadingState.Streaming;
  return { graphResult, loading, range, showingGraph, showingTable, split, timeZone: getTimeZone(state.user) };
}

const mapDispatchToProps = {
  toggleGraph,
  changeTime,
};

export default hot(module)(
  connect(
    mapStateToProps,
    mapDispatchToProps
  )(GraphContainer)
);

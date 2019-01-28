import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import { RawTimeRange, TimeRange } from '@grafana/ui';

import { ExploreId, ExploreItemState } from 'app/types/explore';
import { StoreState } from 'app/types';

import { toggleGraph } from './state/actions';
import Graph from './Graph';
import Panel from './Panel';

interface GraphContainerProps {
  onChangeTime: (range: TimeRange) => void;
  exploreId: ExploreId;
  graphResult?: any[];
  loading: boolean;
  range: RawTimeRange;
  showingGraph: boolean;
  showingTable: boolean;
  split: boolean;
  toggleGraph: typeof toggleGraph;
}

export class GraphContainer extends PureComponent<GraphContainerProps> {
  onClickGraphButton = () => {
    this.props.toggleGraph(this.props.exploreId);
  };

  render() {
    const { exploreId, graphResult, loading, onChangeTime, showingGraph, showingTable, range, split } = this.props;
    const graphHeight = showingGraph && showingTable ? '200px' : '400px';
    return (
      <Panel label="Graph" isOpen={showingGraph} loading={loading} onToggle={this.onClickGraphButton}>
        <Graph
          data={graphResult}
          height={graphHeight}
          id={`explore-graph-${exploreId}`}
          onChangeTime={onChangeTime}
          range={range}
          split={split}
        />
      </Panel>
    );
  }
}

function mapStateToProps(state: StoreState, { exploreId }) {
  const explore = state.explore;
  const { split } = explore;
  const item: ExploreItemState = explore[exploreId];
  const { graphResult, queryTransactions, range, showingGraph, showingTable } = item;
  const loading = queryTransactions.some(qt => qt.resultType === 'Graph' && !qt.done);
  return { graphResult, loading, range, showingGraph, showingTable, split };
}

const mapDispatchToProps = {
  toggleGraph,
};

export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(GraphContainer));

import React from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { StoreState, ExploreItemState, ExploreId } from 'app/types';

export function ChunkProgressDisplay({ loading, queryResponse }: ConnectedProps<typeof connector>) {
  const dataFrames = queryResponse?.series || [];

  console.log(loading, dataFrames);

  return <p>13%</p>;
}

function mapStateToProps(state: StoreState, { exploreId }: { exploreId: ExploreId }) {
  const explore = state.explore;
  const item: ExploreItemState = explore[exploreId]!;
  const { loading, queryResponse } = item;

  return {
    loading,
    queryResponse,
  };
}

const connector = connect(mapStateToProps);

export default connector(ChunkProgressDisplay);

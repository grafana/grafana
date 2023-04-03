import React from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { StoreState, ExploreItemState, ExploreId } from 'app/types';

type Props = { refId?: string } & ConnectedProps<typeof connector>;

export function SplittingProgressDisplay({ queryResponse, refId }: Props) {
  if (!refId) {
    return null;
  }
  const dataFrame = (queryResponse?.series || []).find((frame) => frame.refId === refId);
  if (!dataFrame || dataFrame.meta?.custom?.progress === undefined) {
    return null;
  }

  return <p>{dataFrame.meta?.custom?.progress * 100}%</p>;
}

function mapStateToProps(state: StoreState, { exploreId }: { exploreId: ExploreId }) {
  const explore = state.explore;
  const item: ExploreItemState = explore[exploreId]!;
  const { queryResponse } = item;

  return {
    queryResponse,
  };
}

const connector = connect(mapStateToProps);

export default connector(SplittingProgressDisplay);

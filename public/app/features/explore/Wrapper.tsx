import React, { Component } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';

import { StoreState } from 'app/types';
import { ExploreId, ExploreUrlState } from 'app/types/explore';

import ErrorBoundary from './ErrorBoundary';
import Explore from './Explore';
import { CustomScrollbar } from '@grafana/ui';
import { initializeExploreSplitAction, resetExploreAction } from './state/actionTypes';

interface WrapperProps {
  split: boolean;
  resetExploreAction: typeof resetExploreAction;
  leftUrlState: ExploreUrlState;
  rightUrlState: ExploreUrlState;
}

export class Wrapper extends Component<WrapperProps> {
  componentWillUnmount() {
    this.props.resetExploreAction();
  }

  render() {
    const { split, leftUrlState, rightUrlState } = this.props;

    return (
      <div className="page-scrollbar-wrapper">
        <CustomScrollbar autoHeightMin={'100%'} className="custom-scrollbar--page">
          <div className="explore-wrapper">
            <ErrorBoundary>
              <Explore exploreId={ExploreId.left} urlState={leftUrlState} />
            </ErrorBoundary>
            {split && (
              <ErrorBoundary>
                <Explore exploreId={ExploreId.right} urlState={rightUrlState} />
              </ErrorBoundary>
            )}
          </div>
        </CustomScrollbar>
      </div>
    );
  }
}

const mapStateToProps = (state: StoreState) => {
  const { split, leftUrlState, rightUrlState } = state.explore;
  return { split, leftUrlState, rightUrlState };
};

const mapDispatchToProps = {
  initializeExploreSplitAction,
  resetExploreAction,
};

export default hot(module)(
  connect(
    mapStateToProps,
    mapDispatchToProps
  )(Wrapper)
);

import React, { Component } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';

import { StoreState } from 'app/types';
import { ExploreId } from 'app/types/explore';

import ErrorBoundary from './ErrorBoundary';
import Explore from './Explore';
import { CustomScrollbar } from '@grafana/ui';
import { resetExploreAction } from './state/actionTypes';

interface WrapperProps {
  split: boolean;
  resetExploreAction: typeof resetExploreAction;
}

export class Wrapper extends Component<WrapperProps> {
  componentWillUnmount() {
    this.props.resetExploreAction();
  }

  render() {
    const { split } = this.props;

    return (
      <div className="page-scrollbar-wrapper">
        <CustomScrollbar autoHeightMin={'100%'} className="custom-scrollbar--page">
          <div className="explore-wrapper">
            <ErrorBoundary>
              <Explore exploreId={ExploreId.left} />
            </ErrorBoundary>
            {split && (
              <ErrorBoundary>
                <Explore exploreId={ExploreId.right} />
              </ErrorBoundary>
            )}
          </div>
        </CustomScrollbar>
      </div>
    );
  }
}

const mapStateToProps = (state: StoreState) => {
  const { split } = state.explore;
  return { split };
};

const mapDispatchToProps = {
  resetExploreAction,
};

export default hot(module)(
  connect(
    mapStateToProps,
    mapDispatchToProps
  )(Wrapper)
);

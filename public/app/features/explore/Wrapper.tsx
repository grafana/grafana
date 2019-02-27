import React, { Component } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';

import { updateLocation } from 'app/core/actions';
import { StoreState } from 'app/types';
import { ExploreId, ExploreUrlState } from 'app/types/explore';
import { parseUrlState } from 'app/core/utils/explore';

import ErrorBoundary from './ErrorBoundary';
import Explore from './Explore';
import { CustomScrollbar } from '@grafana/ui';
import { initializeExploreSplitAction, resetExploreAction } from './state/actionTypes';

interface WrapperProps {
  initializeExploreSplitAction: typeof initializeExploreSplitAction;
  split: boolean;
  updateLocation: typeof updateLocation;
  resetExploreAction: typeof resetExploreAction;
  urlStates: { [key: string]: string };
}

export class Wrapper extends Component<WrapperProps> {
  initialSplit: boolean;
  urlStates: { [key: string]: ExploreUrlState };

  constructor(props: WrapperProps) {
    super(props);
    this.urlStates = {};
    const { left, right } = props.urlStates;
    if (props.urlStates.left) {
      this.urlStates.leftState = parseUrlState(left);
    }
    if (props.urlStates.right) {
      this.urlStates.rightState = parseUrlState(right);
      this.initialSplit = true;
    }
  }

  componentDidMount() {
    if (this.initialSplit) {
      this.props.initializeExploreSplitAction();
    }
  }

  componentWillUnmount() {
    this.props.resetExploreAction();
  }

  render() {
    const { split } = this.props;
    const { leftState, rightState } = this.urlStates;

    return (
      <div className="page-scrollbar-wrapper">
        <CustomScrollbar autoHeightMin={'100%'} className="custom-scrollbar--page">
          <div className="explore-wrapper">
            <ErrorBoundary>
              <Explore exploreId={ExploreId.left} urlState={leftState} />
            </ErrorBoundary>
            {split && (
              <ErrorBoundary>
                <Explore exploreId={ExploreId.right} urlState={rightState} />
              </ErrorBoundary>
            )}
          </div>
        </CustomScrollbar>
      </div>
    );
  }
}

const mapStateToProps = (state: StoreState) => {
  const urlStates = state.location.query;
  const { split } = state.explore;
  return { split, urlStates };
};

const mapDispatchToProps = {
  initializeExploreSplitAction,
  updateLocation,
  resetExploreAction,
};

export default hot(module)(
  connect(
    mapStateToProps,
    mapDispatchToProps
  )(Wrapper)
);

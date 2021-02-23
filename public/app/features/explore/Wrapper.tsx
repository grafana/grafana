import React, { Component } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';

import { StoreState } from 'app/types';
import { ExploreId } from 'app/types/explore';

import { CustomScrollbar, ErrorBoundaryAlert } from '@grafana/ui';
import { lastSavedUrl, resetExploreAction, richHistoryUpdatedAction } from './state/main';
import { getRichHistory } from '../../core/utils/richHistory';
import { ExplorePaneContainer } from './ExplorePaneContainer';

interface WrapperProps {
  split: boolean;
  resetExploreAction: typeof resetExploreAction;
  richHistoryUpdatedAction: typeof richHistoryUpdatedAction;
}

export class Wrapper extends Component<WrapperProps> {
  componentWillUnmount() {
    this.props.resetExploreAction({});
  }

  componentDidMount() {
    lastSavedUrl.left = undefined;
    lastSavedUrl.right = undefined;

    const richHistory = getRichHistory();
    this.props.richHistoryUpdatedAction({ richHistory });
  }

  render() {
    const { split } = this.props;

    return (
      <div className="page-scrollbar-wrapper">
        <CustomScrollbar autoHeightMin={'100%'}>
          <div className="explore-wrapper">
            <ErrorBoundaryAlert style="page">
              <ExplorePaneContainer split={split} exploreId={ExploreId.left} />
            </ErrorBoundaryAlert>
            {split && (
              <ErrorBoundaryAlert style="page">
                <ExplorePaneContainer split={split} exploreId={ExploreId.right} />
              </ErrorBoundaryAlert>
            )}
          </div>
        </CustomScrollbar>
      </div>
    );
  }
}

const mapStateToProps = (state: StoreState) => {
  // Here we use URL to say if we should split or not which is different than in other places. Reason is if we change
  // the URL first there is no internal state saying we should split. So this triggers render of ExplorePaneContainer
  // and initialisation of each pane state.
  const isUrlSplit = Boolean(state.location.query[ExploreId.left] && state.location.query[ExploreId.right]);
  return { split: isUrlSplit };
};

const mapDispatchToProps = {
  resetExploreAction,
  richHistoryUpdatedAction,
};

export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(Wrapper));

import React, { Component } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';

import { StoreState } from 'app/types';
import { ExploreId } from 'app/types/explore';

import { CustomScrollbar, ErrorBoundaryAlert } from '@grafana/ui';
import { resetExploreAction, richHistoryUpdatedAction } from './state/main';
import Explore from './Explore';
import { getRichHistory } from '../../core/utils/richHistory';

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
              <Explore exploreId={ExploreId.left} />
            </ErrorBoundaryAlert>
            {split && (
              <ErrorBoundaryAlert style="page">
                <Explore exploreId={ExploreId.right} />
              </ErrorBoundaryAlert>
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
  richHistoryUpdatedAction,
};

export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(Wrapper));

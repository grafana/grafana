import React, { Component } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';

import { StoreState } from 'app/types';
import { ExploreId } from 'app/types/explore';

import { CustomScrollbar, ErrorBoundaryAlert } from '@grafana/ui';
import { resetExploreAction } from './state/actionTypes';
import { SplitPane } from './SplitPane';

interface WrapperProps {
  split: boolean;
  resetExploreAction: typeof resetExploreAction;
}

export class Wrapper extends Component<WrapperProps> {
  componentWillUnmount() {
    this.props.resetExploreAction({});
  }

  render() {
    const { split } = this.props;

    return (
      <div className="page-scrollbar-wrapper">
        <CustomScrollbar autoHeightMin={'100%'} autoHeightMax={''} className="custom-scrollbar--page">
          <div style={{ height: '100%' }} className="explore-wrapper">
            <ErrorBoundaryAlert style="page">
              <SplitPane exploreId={ExploreId.left} />
            </ErrorBoundaryAlert>
            {split && (
              <ErrorBoundaryAlert style="page">
                <SplitPane exploreId={ExploreId.right} />
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
};

export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(Wrapper));

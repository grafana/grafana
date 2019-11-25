import React from 'react';
import { hot } from 'react-hot-loader';

import { ExploreState, StoreState } from 'app/types';
import { ExploreId } from 'app/types/explore';

import Explore from './Explore';
import { CustomScrollbar, ErrorBoundaryAlert } from '@grafana/ui';
import { resetExploreAction } from './state/actionTypes';
import { ReduxComponent } from '../../core/components/ReduxComponent/ReduxComponent';

interface ReduxActions {
  resetExploreAction: typeof resetExploreAction;
}

export class Wrapper extends ReduxComponent<{}, {}, ExploreState, ReduxActions> {
  stateSelector(state: StoreState): ExploreState {
    return state.explore;
  }

  actionsToDispatch(): ReduxActions {
    return { resetExploreAction };
  }

  componentWillUnmount() {
    super.componentWillUnmount();
    this.actions.resetExploreAction({});
  }

  render() {
    const { split } = this.state;

    return (
      <div className="page-scrollbar-wrapper">
        <CustomScrollbar autoHeightMin={'100%'} autoHeightMax={''} className="custom-scrollbar--page">
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

export default hot(module)(Wrapper);

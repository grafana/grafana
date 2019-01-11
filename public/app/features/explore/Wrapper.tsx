import React, { Component } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';

import { updateLocation } from 'app/core/actions';
// import { serializeStateToUrlParam, parseUrlState } from 'app/core/utils/explore';
import { StoreState } from 'app/types';
import { ExploreId } from 'app/types/explore';

import ErrorBoundary from './ErrorBoundary';
import Explore from './Explore';

interface WrapperProps {
  backendSrv?: any;
  datasourceSrv?: any;
  split: boolean;
  updateLocation: typeof updateLocation;
  // urlStates: { [key: string]: string };
}

export class Wrapper extends Component<WrapperProps> {
  // urlStates: { [key: string]: string };

  constructor(props: WrapperProps) {
    super(props);
    // this.urlStates = props.urlStates;
  }

  // onSaveState = (key: string, state: ExploreState) => {
  //   const urlState = serializeStateToUrlParam(state, true);
  //   this.urlStates[key] = urlState;
  //   this.props.updateLocation({
  //     query: this.urlStates,
  //   });
  // };

  render() {
    const { split } = this.props;
    // State overrides for props from first Explore
    // const urlStateLeft = parseUrlState(this.urlStates[STATE_KEY_LEFT]);
    // const urlStateRight = parseUrlState(this.urlStates[STATE_KEY_RIGHT]);

    return (
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
    );
  }
}

const mapStateToProps = (state: StoreState) => {
  // urlStates: state.location.query,
  const { split } = state.explore;
  return { split };
};

const mapDispatchToProps = {
  updateLocation,
};

export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(Wrapper));

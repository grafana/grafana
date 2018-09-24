import React, { PureComponent } from 'react';

import Explore from './Explore';

export default class Wrapper extends PureComponent<any, any> {
  state = {
    initialState: null,
    split: false,
  };

  handleChangeSplit = (split, initialState) => {
    this.setState({ split, initialState });
  };

  render() {
    // State overrides for props from first Explore
    const { initialState, split } = this.state;
    return (
      <div className="explore-wrapper">
        <Explore {...this.props} position="left" onChangeSplit={this.handleChangeSplit} split={split} />
        {split ? (
          <Explore
            {...this.props}
            initialState={initialState}
            onChangeSplit={this.handleChangeSplit}
            position="right"
            split={split}
          />
        ) : null}
      </div>
    );
  }
}

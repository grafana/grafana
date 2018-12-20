import React from 'react';
import { Project } from './Project';

export interface Props {
  datasource: any;
}

interface State {
  displayHelp: boolean;
  displaRawQuery: boolean;
}

export class Help extends React.Component<Props, State> {
  state: State = {
    displayHelp: false,
    displaRawQuery: false,
  };

  handleHelpClicked() {
    this.setState({ displayHelp: !this.state.displayHelp });
  }

  handleRawQueryClicked() {
    this.setState({ displayHelp: !this.state.displayHelp });
  }

  render() {
    const { displayHelp, displaRawQuery } = this.state;
    const { datasource } = this.props;

    return (
      <div className="gf-form-inline">
        <Project datasource={datasource} />
        {/* {displayHelp && ( */}
        <div className="gf-form" ng-show="ctrl.lastQueryMeta">
          <label className="gf-form-label query-keyword" ng-click="ctrl.showHelp = !ctrl.showHelp">
            Show Help
            <i className={`fa fa-caret-${displayHelp ? 'down' : 'right'}`} />
          </label>
        </div>
        {/* )} */}

        {displaRawQuery && (
          <div className="gf-form">
            <label className="gf-form-label query-keyword" ng-click="ctrl.showLastQuery = !ctrl.showLastQuery">
              Raw Query
              <i className={`fa fa-caret-${displaRawQuery ? 'down' : 'right'}`} ng-show="ctrl.showHelp" />
              {/* <i className="fa fa-caret-down" ng-show="ctrl.showLastQuery" />
        <i className="fa fa-caret-right" ng-hide="ctrl.showLastQuery" /> */}
            </label>
          </div>
        )}
        <div className="gf-form gf-form--grow">
          <div className="gf-form-label gf-form-label--grow" />
        </div>
      </div>
    );
  }
}

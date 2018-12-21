import React from 'react';
import _ from 'lodash';

import { getAggregationOptionsByMetric } from '../functions';
import { StackdriverPicker } from './StackdriverPicker';

export interface Props {
  onChange: (metricDescriptor) => void;
  templateSrv: any;
  metricDescriptor: {
    valueType: string;
    metricKind: string;
  };
  crossSeriesReducer: string;
  groupBys: string[];
  children?: (renderProps: any) => JSX.Element;
}

interface State {
  aggOptions: any[];
  displayAdvancedOptions: boolean;
}

export class Aggregations extends React.Component<Props, State> {
  state: State = {
    aggOptions: [],
    displayAdvancedOptions: false,
  };

  componentDidMount() {
    this.setAggOptions(this.props);
  }

  componentWillReceiveProps(nextProps: Props) {
    this.setAggOptions(nextProps);
  }

  setAggOptions({ metricDescriptor }: Props) {
    let aggOptions = [];
    if (metricDescriptor) {
      aggOptions = getAggregationOptionsByMetric(metricDescriptor.valueType, metricDescriptor.metricKind).map(a => ({
        ...a,
        label: a.text,
      }));
    }
    this.setState({ aggOptions });
  }

  handleToggleDisplayAdvanced() {
    this.setState(state => ({
      displayAdvancedOptions: !state.displayAdvancedOptions,
    }));
  }

  render() {
    const { displayAdvancedOptions, aggOptions } = this.state;
    const { templateSrv, onChange, crossSeriesReducer } = this.props;

    return (
      <React.Fragment>
        <div className="gf-form-inline">
          <div className="gf-form">
            <label className="gf-form-label query-keyword width-9">Aggregation</label>
            <StackdriverPicker
              onChange={value => onChange(value)}
              selected={crossSeriesReducer}
              templateVariables={templateSrv.variables}
              options={aggOptions}
              searchable={true}
              placeholder="Select Aggregation"
              className="width-15"
              groupName="Aggregations"
            />
          </div>
          <div className="gf-form gf-form--grow">
            <label className="gf-form-label gf-form-label--grow">
              <a onClick={() => this.handleToggleDisplayAdvanced()}>
                {displayAdvancedOptions ? (
                  <i className="fa fa-caret-down" ng-show="ctrl.target.showAggregationOptions" />
                ) : (
                  <React.Fragment>
                    <i className="fa fa-caret-right" ng-hide="ctrl.target.showAggregationOptions" /> Advanced Options
                  </React.Fragment>
                )}
              </a>
            </label>
          </div>
        </div>
        {this.props.children(this.state.displayAdvancedOptions)}
      </React.Fragment>
    );
  }
}

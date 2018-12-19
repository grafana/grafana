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
  aggregation: {
    crossSeriesReducer: string;
    groupBys: string[];
  };
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

  constructor(props) {
    super(props);
  }

  componentDidMount() {
    if (this.props.metricDescriptor !== null) {
      this.setAggOptions(this.props);
    }
  }

  componentWillReceiveProps(nextProps: Props) {
    if (nextProps.metricDescriptor !== null) {
      this.setAggOptions(nextProps);
    }
  }

  setAggOptions({ metricDescriptor, aggregation, templateSrv }) {
    let aggregations = getAggregationOptionsByMetric(metricDescriptor.valueType, metricDescriptor.metricKind).map(
      a => ({
        ...a,
        label: a.text,
      })
    );

    if (
      aggregations.length > 0 &&
      !aggregations.find(o => o.value === templateSrv.replace(aggregation.crossSeriesReducer))
    ) {
      this.deselectAggregationOption('REDUCE_NONE');
    }

    if (aggregation.groupBys.length > 0) {
      aggregations = aggregations.filter(o => o.value !== 'REDUCE_NONE');
      if (aggregation.crossSeriesReducer === 'REDUCE_NONE') {
        this.deselectAggregationOption('REDUCE_NONE');
      }
    }
    this.setState({ aggOptions: aggregations });
  }

  deselectAggregationOption(notValidOptionValue: string) {
    const aggregations = getAggregationOptionsByMetric(
      this.props.metricDescriptor.valueType,
      this.props.metricDescriptor.metricKind
    );
    const newValue = aggregations.find(o => o.value !== notValidOptionValue);
    this.props.onChange(newValue ? newValue.value : '');
  }

  handleToggleDisplayAdvanced() {
    this.setState(state => ({
      displayAdvancedOptions: !state.displayAdvancedOptions,
    }));
  }

  render() {
    const { aggOptions, displayAdvancedOptions } = this.state;
    const { aggregation, templateSrv, onChange } = this.props;

    return (
      <React.Fragment>
        <div className="gf-form-inline">
          <div className="gf-form">
            <label className="gf-form-label query-keyword width-9">Aggregation</label>
            <StackdriverPicker
              onChange={value => onChange(value)}
              selected={aggregation.crossSeriesReducer}
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

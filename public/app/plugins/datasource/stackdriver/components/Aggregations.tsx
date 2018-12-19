import React from 'react';
import _ from 'lodash';

// import { OptionPicker } from './OptionPicker';
// import { alignmentPeriods } from '../constants';
// import { getAlignmentOptionsByMetric, getAggregationOptionsByMetric } from '../functions';
import { getAggregationOptionsByMetric } from '../functions';
import { StackdriverPicker } from './StackdriverPicker';
// import kbn from 'app/core/utils/kbn';

export interface Props {
  onChange: (metricDescriptor) => void;
  templateSrv: any;
  metricDescriptor: {
    valueType: string;
    metricKind: string;
  };
  aggregation: {
    crossSeriesReducer: string;
    alignmentPeriod: string;
    perSeriesAligner: string;
    groupBys: string[];
  };
}

interface State {
  alignmentPeriods: any[];
  alignOptions: any[];
  aggOptions: any[];
}

export class Aggregations extends React.Component<Props, State> {
  state: State = {
    alignmentPeriods: [],
    alignOptions: [],
    aggOptions: [],
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
    // const { metricDescriptor, aggregation } = this.props;
    // if (
    //   (metricDescriptor !== null && nextProps.metricDescriptor.valueType !== metricDescriptor.valueType) ||
    //   nextProps.metricDescriptor.metricKind !== metricDescriptor.metricKind ||
    //   nextProps.aggregation.groupBys !== aggregation.groupBys
    // ) {
    if (nextProps.metricDescriptor !== null) {
      this.setAggOptions(nextProps);
    }
  }

  setAggOptions({ metricDescriptor, aggregation }) {
    const { templateSrv } = this.props;
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
      this.deselectAggregationOption('REDUCE_NONE');
    }
    this.setState({ aggOptions: aggregations });
  }

  deselectAggregationOption(notValidOptionValue: string) {
    const aggregations = getAggregationOptionsByMetric(
      this.props.metricDescriptor.valueType,
      this.props.metricDescriptor.metricKind
    );
    const newValue = aggregations.find(o => o.value !== notValidOptionValue);
    this.handleAggregationChange(newValue ? newValue.value : '');
  }

  handleAggregationChange(value) {
    this.props.onChange(value);
  }

  render() {
    const { aggOptions } = this.state;
    const { aggregation, templateSrv } = this.props;

    return (
      <React.Fragment>
        <div className="gf-form-inline">
          <div className="gf-form">
            <label className="gf-form-label query-keyword width-9">Aggregation</label>
            <StackdriverPicker
              onChange={value => this.handleAggregationChange(value)}
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
              <a ng-click="ctrl.target.showAggregationOptions = !ctrl.target.showAggregationOptions">
                <i className="fa fa-caret-down" ng-show="ctrl.target.showAggregationOptions" />
                <i className="fa fa-caret-right" ng-hide="ctrl.target.showAggregationOptions" /> Advanced Options
              </a>
            </label>
          </div>
        </div>
      </React.Fragment>
    );
  }
}

import React from 'react';
import _ from 'lodash';

import { SelectableValue } from '@grafana/data';
import { Segment } from '@grafana/ui';
import { getAggregationOptionsByMetric } from '../functions';
import { ValueTypes, MetricKind } from '../constants';
import { MetricDescriptor } from '../types';

export interface Props {
  onChange: (metricDescriptor: MetricDescriptor[]) => void;
  metricDescriptor: {
    valueType: string;
    metricKind: string;
  };
  crossSeriesReducer: string;
  groupBys: string[];
  children?: (renderProps: any) => JSX.Element;
  templateVariableOptions: Array<SelectableValue<string>>;
}

export interface State {
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

  UNSAFE_componentWillReceiveProps(nextProps: Props) {
    this.setAggOptions(nextProps);
  }

  setAggOptions({ metricDescriptor }: Props) {
    let aggOptions: any[] = [];
    if (metricDescriptor) {
      aggOptions = getAggregationOptionsByMetric(
        metricDescriptor.valueType as ValueTypes,
        metricDescriptor.metricKind as MetricKind
      ).map(a => ({
        ...a,
        label: a.text,
      }));
    }
    this.setState({ aggOptions });
  }

  onToggleDisplayAdvanced = () => {
    this.setState(state => ({
      displayAdvancedOptions: !state.displayAdvancedOptions,
    }));
  };

  render() {
    const { displayAdvancedOptions, aggOptions } = this.state;
    const { templateVariableOptions, onChange, crossSeriesReducer } = this.props;

    return (
      <>
        <div className="gf-form-inline">
          <label className="gf-form-label query-keyword width-9">Aggregation</label>
          <Segment
            onChange={({ value }) => onChange(value)}
            value={[...aggOptions, ...templateVariableOptions].find(s => s.value === crossSeriesReducer)}
            options={[
              {
                label: 'Template Variables',
                options: templateVariableOptions,
              },
              {
                label: 'Aggregations',
                expanded: true,
                options: aggOptions,
              },
            ]}
            placeholder="Select Reducer"
          ></Segment>
          <div className="gf-form gf-form--grow">
            <label className="gf-form-label gf-form-label--grow">
              <a onClick={this.onToggleDisplayAdvanced}>
                <>
                  <i className={`fa fa-caret-${displayAdvancedOptions ? 'down' : 'right'}`} /> Advanced Options
                </>
              </a>
            </label>
          </div>
        </div>
        {this.props.children(this.state.displayAdvancedOptions)}
      </>
    );
  }
}

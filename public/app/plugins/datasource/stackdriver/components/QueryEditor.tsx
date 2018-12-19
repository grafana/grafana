import React from 'react';
import _ from 'lodash';

import { Metrics } from './Metrics';
import { Filter } from './Filter';
import { Aggregations } from './Aggregations';
import { Target } from '../types';

export interface Props {
  onQueryChange: (target: Target) => void;
  onExecuteQuery?: () => void;
  target: Target;
  datasource: any;
  templateSrv: any;
  uiSegmentSrv: any;
}

interface State {
  target: Target;
}

const DefaultTarget: Target = {
  defaultProject: 'loading project...',
  metricType: '',
  metricKind: '',
  valueType: '',
  refId: '',
  service: '',
  unit: '',
  aggregation: {
    crossSeriesReducer: 'REDUCE_MEAN',
    alignmentPeriod: 'stackdriver-auto',
    perSeriesAligner: 'ALIGN_MEAN',
    groupBys: [],
  },
  filters: [],
  aliasBy: '',
};

export class QueryEditor extends React.Component<Props, State> {
  state: State = { target: DefaultTarget };

  componentDidMount() {
    this.setState({ target: this.props.target });
  }

  handleMetricTypeChange({ valueType, metricKind, type, unit }) {
    this.setState(
      {
        target: {
          ...this.state.target,
          ...{
            metricType: type,
            unit,
            valueType,
            metricKind,
          },
        },
      },
      () => {
        this.props.onQueryChange(this.state.target);
        this.props.onExecuteQuery();
      }
    );
  }

  handleFilterChange(value) {
    this.setState(
      {
        target: {
          ...this.state.target,
          filters: value,
        },
      },
      () => {
        this.props.onQueryChange(this.state.target);
        this.props.onExecuteQuery();
      }
    );
  }

  handleGroupBysChange(value) {
    this.setState(
      {
        target: {
          ...this.state.target,
          groupBys: value,
        },
      },
      () => {
        this.props.onQueryChange(this.state.target);
        this.props.onExecuteQuery();
      }
    );
  }

  handleAggregationChange(value) {
    const target = {
      ...this.state.target,
      aggregation: {
        ...this.state.target.aggregation,
        crossSeriesReducer: value,
      },
    };
    this.setState({ target }, () => {
      this.props.onQueryChange(target);
      this.props.onExecuteQuery();
    });
  }

  render() {
    const { target } = this.state;
    const { defaultProject, metricType, aggregation } = target;
    const { templateSrv, datasource, uiSegmentSrv } = this.props;

    return (
      <React.Fragment>
        <Metrics
          defaultProject={defaultProject}
          metricType={metricType}
          templateSrv={templateSrv}
          datasource={datasource}
          onChange={value => this.handleMetricTypeChange(value)}
        >
          {metric => (
            <React.Fragment>
              <Filter
                filtersChanged={value => this.handleFilterChange(value)}
                groupBysChanged={value => this.handleGroupBysChange(value)}
                target={target}
                uiSegmentSrv={uiSegmentSrv}
                templateSrv={templateSrv}
                datasource={datasource}
                metricType={metric ? metric.type : ''}
              />
              <Aggregations
                metricDescriptor={metric}
                templateSrv={templateSrv}
                aggregation={aggregation}
                onChange={value => this.handleAggregationChange(value)}
              />
            </React.Fragment>
          )}
        </Metrics>
      </React.Fragment>
    );
  }
}

import React from 'react';
import _ from 'lodash';

import { Metrics } from './Metrics';
import { Filter } from './Filter';
import { Aggregations } from './Aggregations';
import { Alignments } from './Alignments';
import { Target } from '../types';

export interface Props {
  onQueryChange: (target: Target) => void;
  onExecuteQuery?: () => void;
  target: Target;
  datasource: any;
  templateSrv: any;
  uiSegmentSrv: any;
}

const DefaultTarget: Target = {
  defaultProject: 'loading project...',
  metricType: '',
  metricKind: '',
  valueType: '',
  refId: '',
  service: '',
  unit: '',
  crossSeriesReducer: 'REDUCE_MEAN',
  alignmentPeriod: 'stackdriver-auto',
  perSeriesAligner: 'ALIGN_MEAN',
  groupBys: [],
  filters: [],
  aliasBy: '',
};

export class QueryEditor extends React.Component<Props, Target> {
  state: Target = DefaultTarget;

  componentDidMount() {
    this.setState(this.props.target);
  }

  handleMetricTypeChange({ valueType, metricKind, type, unit }) {
    this.setState(
      {
        metricType: type,
        unit,
        valueType,
        metricKind,
      },
      () => {
        // this.props.onQueryChange(this.state);
        this.props.onExecuteQuery();
      }
    );
  }

  handleFilterChange(value) {
    this.setState(
      {
        filters: value,
      },
      () => {
        // this.props.onQueryChange(this.state);
        this.props.onExecuteQuery();
      }
    );
  }

  handleGroupBysChange(value) {
    this.setState(
      {
        groupBys: value,
      },
      () => {
        // this.props.onQueryChange(this.state);
        this.props.onExecuteQuery();
      }
    );
  }

  handleAggregationChange(value) {
    this.setState({ crossSeriesReducer: value }, () => {
      // this.props.onQueryChange(this.state);
      this.props.onExecuteQuery();
    });
  }

  handleAlignmentChange(value) {
    this.setState({ perSeriesAligner: value }, () => {
      // this.props.onQueryChange(this.state);
      this.props.onExecuteQuery();
    });
  }

  componentDidUpdate(prevProps: Props, prevState: Target) {
    this.props.onQueryChange(this.state);
  }

  render() {
    const { defaultProject, metricType, crossSeriesReducer, groupBys, perSeriesAligner } = this.state;
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
                target={this.state}
                uiSegmentSrv={uiSegmentSrv}
                templateSrv={templateSrv}
                datasource={datasource}
                metricType={metric ? metric.type : ''}
              />
              <Aggregations
                metricDescriptor={metric}
                templateSrv={templateSrv}
                crossSeriesReducer={crossSeriesReducer}
                groupBys={groupBys}
                onChange={value => this.handleAggregationChange(value)}
              >
                {displayAdvancedOptions => (
                  <Alignments
                    display={displayAdvancedOptions}
                    metricDescriptor={metric}
                    templateSrv={templateSrv}
                    perSeriesAligner={perSeriesAligner}
                    onChange={value => this.handleAlignmentChange(value)}
                  />
                )}
              </Aggregations>
            </React.Fragment>
          )}
        </Metrics>
      </React.Fragment>
    );
  }
}

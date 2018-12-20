import React from 'react';
import _ from 'lodash';

import { Metrics } from './Metrics';
import { Filter } from './Filter';
import { Aggregations } from './Aggregations';
import { Alignments } from './Alignments';
import { AlignmentPeriods } from './AlignmentPeriods';
import { AliasBy } from './AliasBy';
import { Help } from './Help';
import { Target } from '../types';
import { getAlignmentPickerData } from '../functions';

export interface Props {
  onQueryChange: (target: Target) => void;
  onExecuteQuery?: () => void;
  target: Target;
  datasource: any;
  templateSrv: any;
  uiSegmentSrv: any;
}

interface State extends Target {
  alignOptions: any[];
}

const DefaultTarget: State = {
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
  alignOptions: [],
};

export class QueryEditor extends React.Component<Props, State> {
  state: State = DefaultTarget;

  componentDidMount() {
    const { perSeriesAligner, alignOptions } = getAlignmentPickerData(this.props.target, this.props.templateSrv);
    this.setState({
      ...this.props.target,
      alignOptions,
      perSeriesAligner,
    });
  }

  handleMetricTypeChange({ valueType, metricKind, type, unit }) {
    const { perSeriesAligner, alignOptions } = getAlignmentPickerData(
      { valueType, metricKind, perSeriesAligner: this.state.perSeriesAligner },
      this.props.templateSrv
    );
    this.setState(
      {
        alignOptions,
        perSeriesAligner,
        metricType: type,
        unit,
        valueType,
        metricKind,
      },
      () => {
        this.props.onQueryChange(this.state);
        this.props.onExecuteQuery();
      }
    );
  }

  handleFilterChange(filters) {
    this.setState({ filters }, () => {
      this.props.onQueryChange(this.state);
      this.props.onExecuteQuery();
    });
  }

  handleGroupBysChange(groupBys) {
    this.setState({ groupBys }, () => {
      this.props.onQueryChange(this.state);
      this.props.onExecuteQuery();
    });
  }

  handleAggregationChange(value) {
    this.setState({ crossSeriesReducer: value }, () => {
      this.props.onQueryChange(this.state);
      this.props.onExecuteQuery();
    });
  }

  handleAlignmentChange(value) {
    this.setState({ perSeriesAligner: value }, () => {
      this.props.onQueryChange(this.state);
      this.props.onExecuteQuery();
    });
  }

  handleAlignmentPeriodChange(value) {
    this.setState({ alignmentPeriod: value }, () => {
      this.props.onQueryChange(this.state);
      this.props.onExecuteQuery();
    });
  }

  handleAliasByChange(value) {
    this.setState({ aliasBy: value }, () => {
      this.props.onQueryChange(this.state);
      this.props.onExecuteQuery();
    });
  }

  render() {
    const {
      defaultProject,
      metricType,
      crossSeriesReducer,
      groupBys,
      perSeriesAligner,
      alignOptions,
      alignmentPeriod,
      aliasBy,
    } = this.state;
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
                {displayAdvancedOptions =>
                  displayAdvancedOptions && (
                    <Alignments
                      alignOptions={alignOptions}
                      metricDescriptor={metric}
                      templateSrv={templateSrv}
                      perSeriesAligner={perSeriesAligner}
                      onChange={value => this.handleAlignmentChange(value)}
                    />
                  )
                }
              </Aggregations>
              <AliasBy value={aliasBy} onChange={value => this.handleAliasByChange(value)} />
            </React.Fragment>
          )}
        </Metrics>
        <AlignmentPeriods
          templateSrv={templateSrv}
          alignmentPeriod={alignmentPeriod}
          onChange={value => this.handleAlignmentPeriodChange(value)}
        />

        <Help datasource={datasource} />
        {/* <div className="gf-form-inline">
          <Help datasource={datasource} />
          <div className="gf-form" ng-show="ctrl.lastQueryMeta">
            <label className="gf-form-label query-keyword" ng-click="ctrl.showHelp = !ctrl.showHelp">
              Show Help
              <i className="fa fa-caret-down" ng-show="ctrl.showHelp" />
              <i className="fa fa-caret-right" ng-hide="ctrl.showHelp" />
            </label>
          </div>
          <div className="gf-form" ng-show="ctrl.lastQueryMeta">
            <label className="gf-form-label query-keyword" ng-click="ctrl.showLastQuery = !ctrl.showLastQuery">
              Raw Query
              <i className="fa fa-caret-down" ng-show="ctrl.showLastQuery" />
              <i className="fa fa-caret-right" ng-hide="ctrl.showLastQuery" />
            </label>
          </div>
          <div className="gf-form gf-form--grow">
            <div className="gf-form-label gf-form-label--grow" />
          </div>
        </div> */}
      </React.Fragment>
    );
  }
}

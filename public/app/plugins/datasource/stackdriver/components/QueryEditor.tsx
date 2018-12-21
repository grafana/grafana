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
  events: any;
  datasource: any;
  uiSegmentSrv: any;
}

interface State extends Target {
  alignOptions: any[];
  lastQuery: string;
  lastQueryError: string;
  [key: string]: any;
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
  lastQuery: '',
  lastQueryError: '',
};

export class QueryEditor extends React.Component<Props, State> {
  state: State = DefaultTarget;

  componentDidMount() {
    const { events, target, datasource } = this.props;
    events.on('data-received', this.onDataReceived.bind(this));
    events.on('data-error', this.onDataError.bind(this));
    const { perSeriesAligner, alignOptions } = getAlignmentPickerData(target, datasource.templateSrv);
    this.setState({
      ...this.props.target,
      alignOptions,
      perSeriesAligner,
    });
  }

  onDataReceived(dataList) {
    const series = dataList.find(item => item.refId === this.props.target.refId);
    if (series) {
      this.setState({ lastQuery: decodeURIComponent(series.meta.rawQuery), lastQueryError: '' });
    }
  }

  onDataError(err) {
    let lastQuery;
    let lastQueryError;
    if (err.data && err.data.error) {
      lastQueryError = this.props.datasource.formatStackdriverError(err);
    } else if (err.data && err.data.results) {
      const queryRes = err.data.results[this.props.target.refId];
      lastQuery = decodeURIComponent(queryRes.meta.rawQuery);
      if (queryRes && queryRes.error) {
        try {
          lastQueryError = JSON.parse(queryRes.error).error.message;
        } catch {
          lastQueryError = queryRes.error;
        }
      }
    }
    this.setState({ lastQuery, lastQueryError });
  }

  handleMetricTypeChange({ valueType, metricKind, type, unit }) {
    const { datasource, onQueryChange, onExecuteQuery } = this.props;
    const { perSeriesAligner, alignOptions } = getAlignmentPickerData(
      { valueType, metricKind, perSeriesAligner: this.state.perSeriesAligner },
      datasource.templateSrv
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
        onQueryChange(this.state);
        onExecuteQuery();
      }
    );
  }

  handleChange(prop, value) {
    this.setState({ [prop]: value }, () => {
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
      lastQuery,
      lastQueryError,
    } = this.state;
    const { datasource, uiSegmentSrv } = this.props;

    return (
      <React.Fragment>
        <Metrics
          defaultProject={defaultProject}
          metricType={metricType}
          templateSrv={datasource.templateSrv}
          datasource={datasource}
          onChange={value => this.handleMetricTypeChange(value)}
        >
          {metric => (
            <React.Fragment>
              <Filter
                filtersChanged={value => this.handleChange('filters', value)}
                groupBysChanged={value => this.handleChange('groupBys', value)}
                target={this.state}
                uiSegmentSrv={uiSegmentSrv}
                templateSrv={datasource.templateSrv}
                datasource={datasource}
                metricType={metric ? metric.type : ''}
              />
              <Aggregations
                metricDescriptor={metric}
                templateSrv={datasource.templateSrv}
                crossSeriesReducer={crossSeriesReducer}
                groupBys={groupBys}
                onChange={value => this.handleChange('crossSeriesReducer', value)}
              >
                {displayAdvancedOptions =>
                  displayAdvancedOptions && (
                    <Alignments
                      alignOptions={alignOptions}
                      templateSrv={datasource.templateSrv}
                      perSeriesAligner={perSeriesAligner}
                      onChange={value => this.handleChange('perSeriesAligner', value)}
                    />
                  )
                }
              </Aggregations>
              <AliasBy value={aliasBy} onChange={value => this.handleChange('aliasBy', value)} />

              <AlignmentPeriods
                templateSrv={datasource.templateSrv}
                alignmentPeriod={alignmentPeriod}
                onChange={value => this.handleChange('alignmentPeriod', value)}
              />

              <Help datasource={datasource} rawQuery={lastQuery} lastQueryError={lastQueryError} />
            </React.Fragment>
          )}
        </Metrics>
      </React.Fragment>
    );
  }
}

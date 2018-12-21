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
  templateSrv: any;
  uiSegmentSrv: any;
}

interface State extends Target {
  alignOptions: any[];
  lastQuery: string;
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
};

export class QueryEditor extends React.Component<Props, State> {
  state: State = DefaultTarget;

  componentDidMount() {
    const { events } = this.props;
    events.on('data-received', this.onDataReceived.bind(this));
    events.on('data-error', this.onDataError.bind(this));
    const { perSeriesAligner, alignOptions } = getAlignmentPickerData(this.props.target, this.props.templateSrv);
    this.setState({
      ...this.props.target,
      alignOptions,
      perSeriesAligner,
    });
  }

  onDataReceived(dataList) {
    const anySeriesFromQuery = dataList.find(item => item.refId === this.props.target.refId);
    if (anySeriesFromQuery) {
      this.setState({ lastQuery: decodeURIComponent(anySeriesFromQuery.meta.rawQuery) });
    }
  }

  onDataError(err) {
    // if (err.data && err.data.results) {
    //   const queryRes = err.data.results[this.target.refId];
    //   if (queryRes && queryRes.error) {
    //     this.lastQueryMeta = queryRes.meta;
    //     this.lastQueryMeta.rawQueryString = decodeURIComponent(this.lastQueryMeta.rawQuery);
    //     let jsonBody;
    //     try {
    //       jsonBody = JSON.parse(queryRes.error);
    //     } catch {
    //       this.lastQueryError = queryRes.error;
    //     }
    //     this.lastQueryError = jsonBody.error.message;
    //   }
    // }
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
      lastQuery,
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

              <AlignmentPeriods
                templateSrv={templateSrv}
                alignmentPeriod={alignmentPeriod}
                onChange={value => this.handleAlignmentPeriodChange(value)}
              />

              <Help datasource={datasource} rawQuery={lastQuery} />
            </React.Fragment>
          )}
        </Metrics>
      </React.Fragment>
    );
  }
}

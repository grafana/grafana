import React from 'react';
import _ from 'lodash';

import { TemplateSrv } from 'app/features/templating/template_srv';

import { Metrics } from './Metrics';
import { Filter } from './Filter';
import { Aggregations } from './Aggregations';
import { Alignments } from './Alignments';
import { AlignmentPeriods } from './AlignmentPeriods';
import { AliasBy } from './AliasBy';
import { Help } from './Help';
import { StackdriverQuery, MetricDescriptor } from '../types';
import { getAlignmentPickerData } from '../functions';
import StackdriverDatasource from '../datasource';
import { TimeSeries, SelectableValue } from '@grafana/data';
import { PanelEvents } from '@grafana/data';

export interface Props {
  onQueryChange: (target: StackdriverQuery) => void;
  onExecuteQuery: () => void;
  target: StackdriverQuery;
  events: any;
  datasource: StackdriverDatasource;
  templateSrv: TemplateSrv;
}

interface State extends StackdriverQuery {
  alignOptions: Array<SelectableValue<string>>;
  lastQuery: string;
  lastQueryError: string;
  [key: string]: any;
}

export const DefaultTarget: State = {
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
  usedAlignmentPeriod: '',
};

export class QueryEditor extends React.Component<Props, State> {
  state: State = DefaultTarget;

  componentDidMount() {
    const { events, target, templateSrv } = this.props;
    events.on(PanelEvents.dataReceived, this.onDataReceived.bind(this));
    events.on(PanelEvents.dataError, this.onDataError.bind(this));
    const { perSeriesAligner, alignOptions } = getAlignmentPickerData(target, templateSrv);
    this.setState({
      ...this.props.target,
      alignOptions,
      perSeriesAligner,
    });
  }

  componentWillUnmount() {
    this.props.events.off(PanelEvents.dataReceived, this.onDataReceived);
    this.props.events.off(PanelEvents.dataError, this.onDataError);
  }

  onDataReceived(dataList: TimeSeries[]) {
    const series = dataList.find((item: any) => item.refId === this.props.target.refId);
    if (series) {
      this.setState({
        lastQuery: decodeURIComponent(series.meta.rawQuery),
        lastQueryError: '',
        usedAlignmentPeriod: series.meta.alignmentPeriod,
      });
    }
  }

  onDataError(err: any) {
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

  onMetricTypeChange = ({ valueType, metricKind, type, unit }: MetricDescriptor) => {
    const { templateSrv, onQueryChange, onExecuteQuery } = this.props;
    const { perSeriesAligner, alignOptions } = getAlignmentPickerData(
      { valueType, metricKind, perSeriesAligner: this.state.perSeriesAligner },
      templateSrv
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
  };

  onPropertyChange(prop: string, value: string[]) {
    this.setState({ [prop]: value }, () => {
      this.props.onQueryChange(this.state);
      this.props.onExecuteQuery();
    });
  }

  render() {
    const {
      usedAlignmentPeriod,
      defaultProject,
      metricType,
      crossSeriesReducer,
      groupBys,
      filters,
      perSeriesAligner,
      alignOptions,
      alignmentPeriod,
      aliasBy,
      lastQuery,
      lastQueryError,
      refId,
    } = this.state;
    const { datasource, templateSrv } = this.props;

    return (
      <>
        <Metrics
          defaultProject={defaultProject}
          metricType={metricType}
          templateSrv={templateSrv}
          datasource={datasource}
          onChange={this.onMetricTypeChange}
        >
          {metric => (
            <>
              <Filter
                filtersChanged={value => this.onPropertyChange('filters', value)}
                groupBysChanged={value => this.onPropertyChange('groupBys', value)}
                filters={filters}
                groupBys={groupBys}
                refId={refId}
                hideGroupBys={false}
                templateSrv={templateSrv}
                datasource={datasource}
                metricType={metric ? metric.type : ''}
              />
              <Aggregations
                metricDescriptor={metric}
                templateSrv={templateSrv}
                crossSeriesReducer={crossSeriesReducer}
                groupBys={groupBys}
                onChange={value => this.onPropertyChange('crossSeriesReducer', value)}
              >
                {displayAdvancedOptions =>
                  displayAdvancedOptions && (
                    <Alignments
                      alignOptions={alignOptions}
                      templateSrv={templateSrv}
                      perSeriesAligner={perSeriesAligner}
                      onChange={value => this.onPropertyChange('perSeriesAligner', value)}
                    />
                  )
                }
              </Aggregations>
              <AlignmentPeriods
                templateSrv={templateSrv}
                alignmentPeriod={alignmentPeriod}
                perSeriesAligner={perSeriesAligner}
                usedAlignmentPeriod={usedAlignmentPeriod}
                onChange={value => this.onPropertyChange('alignmentPeriod', value)}
              />
              <AliasBy value={aliasBy} onChange={value => this.onPropertyChange('aliasBy', value)} />
              <Help datasource={datasource} rawQuery={lastQuery} lastQueryError={lastQueryError} />
            </>
          )}
        </Metrics>
      </>
    );
  }
}

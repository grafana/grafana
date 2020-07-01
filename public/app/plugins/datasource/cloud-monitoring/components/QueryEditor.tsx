import React, { PureComponent } from 'react';
import appEvents from 'app/core/app_events';
import { CoreEvents } from 'app/types';
import { MetricQueryEditor, QueryTypeSelector, SLOQueryEditor, Help } from './';
import { CloudMonitoringQuery, MetricQuery, QueryType, SLOQuery } from '../types';
import { defaultQuery } from './MetricQueryEditor';
import { defaultQuery as defaultSLOQuery } from './SLOQueryEditor';
import { toOption, formatCloudMonitoringError } from '../functions';
import CloudMonitoringDatasource from '../datasource';
import { ExploreQueryFieldProps } from '@grafana/data';

export type Props = ExploreQueryFieldProps<CloudMonitoringDatasource, CloudMonitoringQuery>;

interface State {
  lastQueryError: string;
}

export class QueryEditor extends PureComponent<Props, State> {
  state: State = { lastQueryError: '' };

  async UNSAFE_componentWillMount() {
    const { datasource, query } = this.props;

    // Unfortunately, migrations like this need to go componentWillMount. As soon as there's
    // migration hook for this module.ts, we can do the migrations there instead.
    if (!this.props.query.hasOwnProperty('metricQuery')) {
      const { hide, refId, datasource, key, queryType, maxLines, metric, ...metricQuery } = this.props.query as any;
      this.props.query.metricQuery = metricQuery;
    }

    if (!this.props.query.hasOwnProperty('queryType')) {
      this.props.query.queryType = QueryType.METRICS;
    }

    await datasource.ensureGCEDefaultProject();
    if (!query.metricQuery.projectName) {
      this.props.query.metricQuery.projectName = datasource.getDefaultProject();
    }
  }

  componentDidMount() {
    appEvents.on(CoreEvents.dsRequestError, this.onDataError.bind(this));
    appEvents.on(CoreEvents.dsRequestResponse, this.onDataResponse.bind(this));
  }

  componentWillUnmount() {
    appEvents.off(CoreEvents.dsRequestResponse, this.onDataResponse.bind(this));
    appEvents.on(CoreEvents.dsRequestError, this.onDataError.bind(this));
  }

  onDataResponse() {
    this.setState({ lastQueryError: '' });
  }

  onDataError(error: any) {
    this.setState({ lastQueryError: formatCloudMonitoringError(error) });
  }

  onQueryChange(prop: string, value: any) {
    this.props.onChange({ ...this.props.query, [prop]: value });
    this.props.onRunQuery();
  }

  render() {
    const { datasource, query, onRunQuery, onChange } = this.props;
    const metricQuery = { ...defaultQuery, projectName: datasource.getDefaultProject(), ...query.metricQuery };
    const sloQuery = { ...defaultSLOQuery, projectName: datasource.getDefaultProject(), ...query.sloQuery };
    const queryType = query.queryType || QueryType.METRICS;
    const meta = this.props.data?.series.length ? this.props.data?.series[0].meta : {};
    const usedAlignmentPeriod = meta?.alignmentPeriod as string;
    const variableOptionGroup = {
      label: 'Template Variables',
      expanded: false,
      options: datasource.variables.map(toOption),
    };

    return (
      <>
        <QueryTypeSelector
          value={queryType}
          templateVariableOptions={variableOptionGroup.options}
          onChange={(queryType: QueryType) => {
            onChange({ ...query, sloQuery, queryType });
            onRunQuery();
          }}
        ></QueryTypeSelector>

        {queryType === QueryType.METRICS && (
          <MetricQueryEditor
            refId={query.refId}
            variableOptionGroup={variableOptionGroup}
            usedAlignmentPeriod={usedAlignmentPeriod}
            onChange={(query: MetricQuery) => this.onQueryChange('metricQuery', query)}
            onRunQuery={onRunQuery}
            datasource={datasource}
            query={metricQuery}
          ></MetricQueryEditor>
        )}

        {queryType === QueryType.SLO && (
          <SLOQueryEditor
            variableOptionGroup={variableOptionGroup}
            usedAlignmentPeriod={usedAlignmentPeriod}
            onChange={(query: SLOQuery) => this.onQueryChange('sloQuery', query)}
            onRunQuery={onRunQuery}
            datasource={datasource}
            query={sloQuery}
          ></SLOQueryEditor>
        )}
        <Help
          rawQuery={decodeURIComponent(meta?.executedQueryString ?? '')}
          lastQueryError={this.state.lastQueryError}
        />
      </>
    );
  }
}

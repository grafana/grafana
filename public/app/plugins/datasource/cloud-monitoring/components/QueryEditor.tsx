import React, { PureComponent } from 'react';
import appEvents from 'app/core/app_events';
import { CoreEvents } from 'app/types';
import { ExploreQueryFieldProps, SelectableValue } from '@grafana/data';
import { Segment } from '@grafana/ui';
import { Help, MetricQueryEditor, SLOQueryEditor } from './';
import { CloudMonitoringQuery, MetricQuery, QueryType, SLOQuery, queryTypes, EditorMode } from '../types';
import { defaultQuery } from './MetricQueryEditor';
import { defaultQuery as defaultSLOQuery } from './SLOQueryEditor';
import { formatCloudMonitoringError, toOption } from '../functions';
import CloudMonitoringDatasource from '../datasource';

export type Props = ExploreQueryFieldProps<CloudMonitoringDatasource, CloudMonitoringQuery>;

interface State {
  lastQueryError: string;
}

export class QueryEditor extends PureComponent<Props, State> {
  state: State = { lastQueryError: '' };

  async UNSAFE_componentWillMount() {
    const { datasource, query } = this.props;

    // Unfortunately, migrations like this need to go UNSAFE_componentWillMount. As soon as there's
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
    const metricQuery = { ...defaultQuery(datasource), ...query.metricQuery };
    const sloQuery = { ...defaultSLOQuery(datasource), ...query.sloQuery };
    const queryType = query.queryType || QueryType.METRICS;
    const meta = this.props.data?.series.length ? this.props.data?.series[0].meta : {};
    const usedAlignmentPeriod = meta?.alignmentPeriod;
    const variableOptionGroup = {
      label: 'Template Variables',
      expanded: false,
      options: datasource.getVariables().map(toOption),
    };

    return (
      <>
        <div className="gf-form-inline">
          <label className="gf-form-label query-keyword width-9">Query Type</label>
          <Segment
            value={[...queryTypes, ...variableOptionGroup.options].find(qt => qt.value === queryType)}
            options={[
              ...queryTypes,
              {
                label: 'Template Variables',
                options: variableOptionGroup.options,
              },
            ]}
            onChange={({ value }: SelectableValue<QueryType>) => {
              onChange({ ...query, sloQuery, queryType: value! });
              onRunQuery();
            }}
          />

          {query.queryType !== QueryType.SLO && (
            <button
              className="gf-form-label "
              onClick={() =>
                this.onQueryChange('metricQuery', {
                  ...metricQuery,
                  editorMode: metricQuery.editorMode === EditorMode.MQL ? EditorMode.Visual : EditorMode.MQL,
                })
              }
            >
              <span className="query-keyword">{'<>'}</span>&nbsp;&nbsp;
              {metricQuery.editorMode === EditorMode.MQL ? 'Switch to builder' : 'Edit MQL'}
            </button>
          )}

          <div className="gf-form gf-form--grow">
            <label className="gf-form-label gf-form-label--grow"></label>
          </div>
        </div>

        {queryType === QueryType.METRICS && (
          <MetricQueryEditor
            refId={query.refId}
            variableOptionGroup={variableOptionGroup}
            usedAlignmentPeriod={usedAlignmentPeriod}
            onChange={(metricQuery: MetricQuery) => {
              this.props.onChange({ ...this.props.query, metricQuery });
            }}
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

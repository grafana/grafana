import React, { PureComponent } from 'react';
import { css } from '@emotion/css';
import { ExploreQueryFieldProps } from '@grafana/data';
import { Button, Select } from '@grafana/ui';
import { MetricQueryEditor, SLOQueryEditor, InlineFields } from './';
import { CloudMonitoringQuery, MetricQuery, QueryType, SLOQuery, queryTypes, EditorMode } from '../types';
import { LABEL_WIDTH, SELECT_WIDTH } from '../constants';
import { defaultQuery } from './MetricQueryEditor';
import { defaultQuery as defaultSLOQuery } from './SLO/SLOQueryEditor';
import { toOption } from '../functions';
import CloudMonitoringDatasource from '../datasource';

export type Props = ExploreQueryFieldProps<CloudMonitoringDatasource, CloudMonitoringQuery>;

export class QueryEditor extends PureComponent<Props> {
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
    const customMetaData = meta?.custom ?? {};
    const variableOptionGroup = {
      label: 'Template Variables',
      expanded: false,
      options: datasource.getVariables().map(toOption),
    };

    return (
      <>
        <InlineFields label="Query Type" transparent labelWidth={LABEL_WIDTH}>
          <Select
            width={SELECT_WIDTH}
            value={queryType}
            options={queryTypes}
            onChange={({ value }) => {
              onChange({ ...query, sloQuery, queryType: value! });
              onRunQuery();
            }}
          />

          {query.queryType !== QueryType.SLO && (
            <Button
              className={css`
                margin-left: auto;
              `}
              icon="edit"
              onClick={() =>
                this.onQueryChange('metricQuery', {
                  ...metricQuery,
                  editorMode: metricQuery.editorMode === EditorMode.MQL ? EditorMode.Visual : EditorMode.MQL,
                })
              }
            >
              {metricQuery.editorMode === EditorMode.MQL ? 'Switch to builder' : 'Edit MQL'}
            </Button>
          )}
        </InlineFields>

        {queryType === QueryType.METRICS && (
          <MetricQueryEditor
            refId={query.refId}
            variableOptionGroup={variableOptionGroup}
            customMetaData={customMetaData}
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
            customMetaData={customMetaData}
            onChange={(query: SLOQuery) => this.onQueryChange('sloQuery', query)}
            onRunQuery={onRunQuery}
            datasource={datasource}
            query={sloQuery}
          ></SLOQueryEditor>
        )}
      </>
    );
  }
}

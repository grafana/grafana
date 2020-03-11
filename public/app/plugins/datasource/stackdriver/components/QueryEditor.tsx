import React, { PureComponent } from 'react';
import { MetricQueryEditor, QueryTypeSelector, SLOQueryEditor, Help } from './';
import { StackdriverQuery, MetricQuery, QueryType, SLOQuery } from '../types';
import { defaultQuery } from './MetricQueryEditor';
import { defaultQuery as defaultSLOQuery } from './SLOQueryEditor';
import { toOption } from '../functions';
import StackdriverDatasource from '../datasource';
import { ExploreQueryFieldProps } from '@grafana/data';

export type Props = ExploreQueryFieldProps<StackdriverDatasource, StackdriverQuery>;

export class QueryEditor extends PureComponent<Props> {
  async componentWillMount() {
    const { datasource, query } = this.props;

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
            onChange({ ...query, queryType });
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
        <Help rawQuery={decodeURIComponent(meta.rawQuery ?? '')} lastQueryError={''} />
      </>
    );
  }
}

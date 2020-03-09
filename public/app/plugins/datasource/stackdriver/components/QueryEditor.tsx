import React, { PureComponent } from 'react';
import { MetricQueryEditor } from './';
import { StackdriverQuery, MetricQuery } from '../types';
import { defaultQuery } from './MetricQueryEditor';
import StackdriverDatasource from '../datasource';
import { ExploreQueryFieldProps } from '@grafana/data';

export type Props = ExploreQueryFieldProps<StackdriverDatasource, StackdriverQuery>;

export class QueryEditor extends PureComponent<Props> {
  async componentDidMount() {
    const { datasource, query } = this.props;

    if (!this.props.query.hasOwnProperty('metricQuery')) {
      const { hide, refId, datasource, key, queryType, maxLines, metric, ...metricQuery } = this.props.query as any;
      this.props.query.metricQuery = metricQuery;
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
    const { datasource, query, onRunQuery } = this.props;
    const metricQuery = { ...defaultQuery, projectName: datasource.getDefaultProject(), ...query.metricQuery };

    return (
      <>
        <MetricQueryEditor
          refId={query.refId}
          onChange={(query: MetricQuery) => this.onQueryChange('metricQuery', query)}
          onRunQuery={onRunQuery}
          datasource={datasource}
          query={metricQuery}
        ></MetricQueryEditor>
      </>
    );
  }
}

import defaults from 'lodash/defaults';
import { lastValueFrom } from 'rxjs';
import React, { ChangeEvent, PureComponent } from 'react';
import { Select, AsyncMultiSelect, AsyncSelect, Input, InlineField, InlineFieldRow } from '@grafana/ui';
import { QueryEditorProps, SelectableValue } from '@grafana/data';
import { DataSource } from './datasource';
import { defaultQuery, MyDataSourceOptions, GetQuery, QueryType } from './types';
import { changeQueryType, QueryTypeInfo, queryTypeInfos } from 'queryInfo';
import DimensionSettings from './QueryDimensions';
import AggregateSettings from './QueryAggregations';
import OrderSettings from './QueryOrders';
import DisplayNameSettings from 'QueryDisplayNames';

type Props = QueryEditorProps<DataSource, GetQuery, MyDataSourceOptions>;

const labelWidth = 20;
const fieldWidth = 50;

interface State {
  isLoadingDataSets: boolean;
  isLoadingMetrics: boolean;
}

export class QueryEditor extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = { isLoadingDataSets: false, isLoadingMetrics: false };

    const { onChange, query } = this.props;

    onChange({ ...query });
  };

  loadDatasets = async (): Promise<Array<SelectableValue<string>>> => {
    this.setState({ isLoadingDataSets: true });
    const { datasource } = this.props;

    try {
      return await lastValueFrom(datasource.listDatasets());
    } finally {
      this.setState({ isLoadingDataSets: false });
    }
  };

  loadMetrics = async (): Promise<Array<SelectableValue<string>>> => {
    this.setState({ isLoadingMetrics: true });
    const { datasource } = this.props;

    try {
      return await lastValueFrom(datasource.listMetrics(this.props.query.dataset || ''));
    } finally {
      this.setState({ isLoadingMetrics: false });
    }
  };

  onQueryTypeChange = (item: SelectableValue<QueryType>) => {
    const { onChange, query, onRunQuery } = this.props;

    onChange(changeQueryType(query, item as QueryTypeInfo));
    onRunQuery();
  };

  onDatasetChange(item: SelectableValue<string>) {
    const { onChange, query, onRunQuery } = this.props;

    query.metrics?.splice(0, query.metrics?.length)
    query.dimensions?.splice(0, query.dimensions?.length);
    query.aggregations?.splice(0, query.aggregations?.length)
    query.orders?.splice(0, query.orders?.length);
    query.displayNames?.splice(0, query.displayNames?.length);

    onChange({ ...query, dataset: item.value });
    onRunQuery();
  };

  onMetricsChange(item: Array<SelectableValue<string>>) {
    const { onChange, query, onRunQuery } = this.props;
    const m = item.map((x) => ({ metricId: x.value! }));

    if (query.displayNames != undefined) {
      for (let i = 0; i < query.displayNames.length; i++) {
        if (!m?.some(m => m.metricId === query.displayNames![i].field)) {
          query.displayNames.splice(i, 1);
        }
      }
    }

    onChange({ ...query, metrics: m });
    onRunQuery();
  };

  onMaxItemsChange = (item: ChangeEvent<HTMLInputElement>) => {
    const { onChange, query, onRunQuery } = this.props;

    onChange({ ...query, maxItems: item && item.target.value });
    onRunQuery();
  };

  render() {
    const query = defaults(this.props.query, defaultQuery);
    const currentQueryType = queryTypeInfos.find((q) => q.value === query.queryType);
    const state = this.state;
    const selectedDataset = { label: query.dataset, value: query.dataset };
    const selectedMetrics = query.metrics?.map((m) => ({ label: m.metricId, value: m.metricId }));

    return (
      <>
        <div className="gf-form-group">
          <div className="gf-form">
            <h6>General Details</h6>
          </div>
          <InlineFieldRow>
            <InlineField label="Query Type" labelWidth={labelWidth}>
              <Select
                options={queryTypeInfos}
                value={currentQueryType}
                onChange={this.onQueryTypeChange}
                width={fieldWidth}
              />
            </InlineField>
          </InlineFieldRow>
          <InlineFieldRow>
            <InlineField label="Data Set" labelWidth={labelWidth}>
              <AsyncSelect
                defaultOptions={true}
                value={selectedDataset}
                loadOptions={this.loadDatasets}
                isLoading={state.isLoadingDataSets}
                onChange={(sel) => this.onDatasetChange(sel)}
                isSearchable={true}
                width={fieldWidth}
              />
            </InlineField>
          </InlineFieldRow>
          <InlineFieldRow>
            <InlineField label="Metrics" grow={true} labelWidth={labelWidth}>
              <AsyncMultiSelect
                key={selectedDataset.value}
                defaultOptions={true}
                value={selectedMetrics}
                loadOptions={this.loadMetrics}
                isLoading={state.isLoadingMetrics}
                onChange={(sel) => this.onMetricsChange(sel)}
                isSearchable={true}
              />
            </InlineField>
          </InlineFieldRow>
        </div>
        <DimensionSettings
          query={query}
          datasource={this.props.datasource}
          onChange={this.props.onChange}
        />
        {currentQueryType?.value === QueryType.GetMetricAggregate ?
          <>
            <AggregateSettings
              query={query}
              onChange={this.props.onChange}
            />
            <OrderSettings
              query={query}
              onChange={this.props.onChange}
            />
          </>
          : null}
        {currentQueryType?.value === QueryType.GetMetricTable ?
        <>
          <OrderSettings
            query={query}
            onChange={this.props.onChange}
          />
        </>
        : null}
        <DisplayNameSettings
          query={query}
          onChange={this.props.onChange}
        />
        {currentQueryType?.value !== QueryType.GetMetricValue ?
          <InlineFieldRow>
            <InlineField label="Top" labelWidth={labelWidth}>
              <Input
                value={query.maxItems}
                onChange={this.onMaxItemsChange}
                width={fieldWidth}
              />
            </InlineField>
          </InlineFieldRow>
          : null}
      </>
    );
  }
}

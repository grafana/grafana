import defaults from 'lodash/defaults';
import { lastValueFrom } from 'rxjs';
import React, { PureComponent } from 'react';
import { AsyncSelect, InlineField, InlineFieldRow } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';
import { DataSource } from './datasource';
import { defaultQuery, ListDimensionValuesQuery } from './types';
import DimensionSettings from './QueryDimensions';

interface Props {
  query: ListDimensionValuesQuery;
  datasource: DataSource;
  onChange: (query: ListDimensionValuesQuery) => void;
}

const labelWidth = 20;
const fieldWidth = 50;

export interface State {
  isLoadingDataSets: boolean;
  isLoadingDimensionKeys: boolean;
}

export class VariableQueryEditor extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = { isLoadingDataSets: false, isLoadingDimensionKeys: false };

    const { onChange, query } = this.props;

    onChange({ ...query });
  }

  onDatasetChange = (evt: SelectableValue<string>) => {
    const { onChange, query } = this.props;

    onChange({ ...query, dataset: evt.value, dimensionKey: undefined, dimensions: [] });
  }

  onDimensionKeyChange = (evt: SelectableValue<string>) => {
    const { onChange, query } = this.props;

    onChange({ ...query, dimensionKey: evt.value });
  }

  loadDatasets = async (): Promise<Array<SelectableValue<string>>> => {
    this.setState({ isLoadingDataSets: true });
    const { datasource } = this.props;

    try {
      return await lastValueFrom(datasource.listDatasets());
    } finally {
      this.setState({ isLoadingDataSets: false });
    }
  };

  loadDimensionKeys = async (): Promise<Array<SelectableValue<string>>> => {
    const selectedDataset = this.props.query.dataset;

    if (selectedDataset != undefined) {
      try {
        this.setState({ isLoadingDimensionKeys: true });
        return await this.props.datasource.listDimensionKeys(selectedDataset);
      } finally {
        this.setState({ isLoadingDimensionKeys: false });
      }
    } else {
      return [];
    }
  };

  render() {
    const query = defaults(this.props.query, defaultQuery);
    const selectedDataset = { label: query.dataset, value: query.dataset };
    const selectedDimensionKey = { label: query.dimensionKey, value: query.dimensionKey };
    const state = this.state;
    return (
      <>
        <div className="gf-form-group">
          <div className="gf-form">
            <h6>General Details</h6>
          </div>
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
            <InlineField label="Key" labelWidth={labelWidth}>
              <AsyncSelect
                key={selectedDataset.value}
                defaultOptions={true}
                value={selectedDimensionKey}
                loadOptions={this.loadDimensionKeys}
                isLoading={state.isLoadingDimensionKeys}
                onChange={(evt) => this.onDimensionKeyChange(evt)}
                isSearchable={true}
                width={fieldWidth}
              />
            </InlineField>
          </InlineFieldRow>
        </div>
        <DimensionSettings
          query={query}
          datasource={this.props.datasource}
          onChange={this.props.onChange}
          label={'Filter'} />
      </>
    );
  }
}

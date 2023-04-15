import React, { PureComponent } from 'react';

// Components

import { DataSourceInstanceSettings, DataSourceRef, getDataSourceUID } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { DataSourceJsonData } from '@grafana/schema';

import { DataSourceDropdown } from './DataSourceDropdown';
import { DataSourcePickerProps } from './types';

/**
 * Component state description for the {@link DataSourcePicker}
 *
 * @internal
 */
export interface DataSourcePickerState {
  error?: string;
}

/**
 * Component to be able to select a datasource from the list of installed and enabled
 * datasources in the current Grafana instance.
 *
 * @internal
 */
export class DataSourcePicker extends PureComponent<DataSourcePickerProps, DataSourcePickerState> {
  dataSourceSrv = getDataSourceSrv();

  state: DataSourcePickerState = {};

  componentDidMount() {
    const { current } = this.props;
    const dsSettings = this.dataSourceSrv.getInstanceSettings(current);
    if (!dsSettings) {
      this.setState({ error: 'Could not find data source ' + current });
    }
  }

  onChange = (ds: DataSourceInstanceSettings<DataSourceJsonData>) => {
    this.props.onChange(ds);
    this.setState({ error: undefined });
  };

  private getCurrentDs(): DataSourceInstanceSettings<DataSourceJsonData> | string | DataSourceRef | null | undefined {
    const { current, noDefault } = this.props;
    if (!current && noDefault) {
      return;
    }

    const ds = this.dataSourceSrv.getInstanceSettings(current);
    if (ds) {
      return ds;
    }

    return getDataSourceUID(current);
  }

  getDatasources() {
    const { alerting, tracing, metrics, mixed, dashboard, variables, annotations, pluginId, type, filter, logs } =
      this.props;

    return this.dataSourceSrv.getList({
      alerting,
      tracing,
      metrics,
      logs,
      dashboard,
      mixed,
      variables,
      annotations,
      pluginId,
      filter,
      type,
    });
  }

  render() {
    const { recentlyUsed, fileUploadOptions, enableFileUpload } = this.props;

    return (
      <div>
        <DataSourceDropdown
          datasources={this.getDatasources()}
          onChange={this.onChange}
          recentlyUsed={recentlyUsed}
          current={this.getCurrentDs()}
          fileUploadOptions={fileUploadOptions}
          enableFileUpload={enableFileUpload}
        />
      </div>
    );
  }
}

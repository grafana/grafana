import { css } from '@emotion/css';
import React, { PureComponent } from 'react';

import { DataSourceInstanceSettings, DataSourceRef, GrafanaTheme2 } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { VerticalGroup } from '@grafana/ui';

import { DataSourceCard } from './DataSourceCard';

/**
 * Component props description for the {@link DataSourceList}
 *
 * @internal
 */
export interface DataSourceListProps {
  className?: string;
  onChange: (ds: DataSourceInstanceSettings) => void;
  current: DataSourceRef | string | null; // uid
  tracing?: boolean;
  mixed?: boolean;
  dashboard?: boolean;
  metrics?: boolean;
  type?: string | string[];
  annotations?: boolean;
  variables?: boolean;
  alerting?: boolean;
  pluginId?: string;
  /** If true,we show only DSs with logs; and if true, pluginId shouldnt be passed in */
  logs?: boolean;
  width?: number;
  inputId?: string;
  filter?: (dataSource: DataSourceInstanceSettings) => boolean;
  onClear?: () => void;
}

/**
 * Component state description for the {@link DataSourceList}
 *
 * @internal
 */
export interface DataSourceListState {
  error?: string;
}

/**
 * Component to be able to select a datasource from the list of installed and enabled
 * datasources in the current Grafana instance.
 *
 * @internal
 */
export class DataSourceList extends PureComponent<DataSourceListProps, DataSourceListState> {
  dataSourceSrv = getDataSourceSrv();

  static defaultProps: Partial<DataSourceListProps> = {
    filter: () => true,
  };

  state: DataSourceListState = {};

  constructor(props: DataSourceListProps) {
    super(props);
  }

  componentDidMount() {
    const { current } = this.props;
    const dsSettings = this.dataSourceSrv.getInstanceSettings(current);
    if (!dsSettings) {
      this.setState({ error: 'Could not find data source ' + current });
    }
  }

  onChange = (item: DataSourceInstanceSettings) => {
    const dsSettings = this.dataSourceSrv.getInstanceSettings(item);

    if (dsSettings) {
      this.props.onChange(dsSettings);
      this.setState({ error: undefined });
    }
  };

  getDataSourceOptions() {
    const { alerting, tracing, metrics, mixed, dashboard, variables, annotations, pluginId, type, filter, logs } =
      this.props;

    const options = this.dataSourceSrv.getList({
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

    return options;
  }

  render() {
    const { className } = this.props;
    // QUESTION: Should we use data from the Redux store as admin DS view does?
    const options = this.getDataSourceOptions();

    return (
      <div className={className}>
        <VerticalGroup spacing="xs">
          {options.map((ds) => (
            <DataSourceCard
              key={ds.uid}
              ds={ds}
              onClick={this.onChange.bind(this, ds)}
              selected={ds.uid === this.props.current}
            />
          ))}
        </VerticalGroup>
      </div>
    );
  }
}

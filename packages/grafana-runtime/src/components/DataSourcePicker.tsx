import React from 'react';

import { DataSourceRef, DataSourceInstanceSettings } from '@grafana/data';

/**
 * Component props description for the {@link DataSourcePicker}
 *
 * @internal
 */
export interface DataSourcePickerProps {
  onChange: (ds: DataSourceInstanceSettings) => void;
  current?: DataSourceRef | string | null; // uid
  hideTextValue?: boolean;
  onBlur?: () => void;
  autoFocus?: boolean;
  openMenuOnFocus?: boolean;
  placeholder?: string;
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
  // If set to true and there is no value select will be empty, otherwise it will preselect default data source
  noDefault?: boolean;
  width?: number;
  inputId?: string;
  filter?: (dataSource: DataSourceInstanceSettings) => boolean;
  onClear?: () => void;
  invalid?: boolean;
  disabled?: boolean;
  isLoading?: boolean;
}

/**
 * Component state description for the {@link DataSourcePicker}
 *
 * @internal
 */
export interface DataSourcePickerState {
  error?: string;
}

/**
 * Simplified type with defaults that describes the DataSourcePicker.
 *
 * @internal
 */
export type DataSourcePickerType = React.ComponentType<DataSourcePickerProps>;

/**
 * DataSourcePicker component that will be set via the {@link setDataSourcePicker} function
 * when Grafana starts. The implementation being used during runtime lives in Grafana
 * core.
 *
 * @internal
 */
export let DataSourcePicker: DataSourcePickerType = () => {
  return <div>DataSourcePicker can only be used after Grafana instance has been started.</div>;
};

/**
 * Used to bootstrap the DataSourcePicker during application start so the DataSourcePicker
 * is exposed via runtime.
 *
 * @internal
 */
export function setDataSourcePicker(renderer: DataSourcePickerType) {
  DataSourcePicker = renderer;
}

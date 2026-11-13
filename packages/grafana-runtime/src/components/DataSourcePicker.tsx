import { type ComponentType } from 'react';

import { type DataSourceInstanceSettings } from '@grafana/data';
import { type DataSourceRef } from '@grafana/schema';

/**
 * Component props description for the {@link DataSourcePicker}
 *
 * @internal
 */
export interface DataSourcePickerProps {
  onChange: (ds: DataSourceInstanceSettings) => void;
  current: DataSourceRef | string | undefined | null; // uid
  hideTextValue?: boolean;
  /** @deprecated No longer supported. The picker manages its own focus and open state. */
  onBlur?: () => void;
  /** @deprecated No longer supported. The picker manages its own focus and open state. */
  autoFocus?: boolean;
  /** @deprecated No longer supported. The picker manages its own focus and open state. */
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

type DataSourcePickerComponentType = ComponentType<DataSourcePickerProps>;

let DataSourcePickerComponent: DataSourcePickerComponentType | undefined;

/**
 * Used to bootstrap the DataSourcePicker during application start, so the
 * picker exposed to plugins renders the core Grafana implementation.
 *
 * @internal
 */
export function setDataSourcePicker(component: DataSourcePickerComponentType | undefined) {
  DataSourcePickerComponent = component;
}

/**
 * Component to be able to select a datasource from the list of installed and enabled
 * datasources in the current Grafana instance.
 */
export function DataSourcePicker(props: DataSourcePickerProps) {
  if (DataSourcePickerComponent) {
    return <DataSourcePickerComponent {...props} />;
  }

  return <div>DataSourcePicker can only be used after Grafana instance has been started.</div>;
}

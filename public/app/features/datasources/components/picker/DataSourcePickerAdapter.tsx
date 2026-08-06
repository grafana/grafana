import { type DataSourcePickerProps as RuntimeDataSourcePickerProps } from '@grafana/runtime';

import { DataSourcePicker } from './DataSourcePicker';

/**
 * Adapts the @grafana/runtime DataSourcePicker prop contract to the core
 * DataSourcePicker. Injected into @grafana/runtime via setDataSourcePicker.
 */
export function DataSourcePickerAdapter(props: RuntimeDataSourcePickerProps) {
  // The core picker manages its own focus and open state, so these props are not supported
  const { onBlur, autoFocus, openMenuOnFocus, ...rest } = props;

  return <DataSourcePicker {...rest} />;
}

import React from 'react';

import {
  DataSourcePicker as DeprecatedDataSourcePicker,
  DataSourcePickerProps as DeprecatedDataSourcePickerProps,
} from '@grafana/runtime';
import { config } from 'app/core/config';

import { DataSourceDropdown, DataSourceDropdownProps } from './DataSourceDropdown';

type DataSourcePickerProps = DeprecatedDataSourcePickerProps | DataSourceDropdownProps;

/**
 * DataSourcePicker is a wrapper around the old DataSourcePicker and the new one.
 * Depending on the feature toggle, it will render the old or the new one.
 * Feature toggle: advancedDataSourcePicker
 */
export function DataSourcePicker(props: DataSourcePickerProps) {
  return !config.featureToggles.advancedDataSourcePicker ? (
    <DeprecatedDataSourcePicker {...props} />
  ) : (
    <DataSourceDropdown {...props} />
  );
}

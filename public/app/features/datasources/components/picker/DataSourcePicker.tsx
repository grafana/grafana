import React from 'react';

import {
  DataSourcePicker as DeprecatedDataSourcePicker,
  DataSourcePickerProps as DeprecatedDataSourcePickerProps,
} from '@grafana/runtime';
import { config } from 'app/core/config';

import { DataSourcePickerWithHistory } from './DataSourcePickerWithHistory';
import { DataSourcePickerWithHistoryProps } from './types';

type DataSourcePickerProps = DeprecatedDataSourcePickerProps | DataSourcePickerWithHistoryProps;

/**
 * DataSourcePicker is a wrapper around the old DataSourcePicker and the new one.
 * Depending on the feature toggle, it will render the old or the new one.
 * Feature toggle: advancedDataSourcePicker
 */
export function DataSourcePicker(props: DataSourcePickerProps) {
  return !config.featureToggles.advancedDataSourcePicker ? (
    <DeprecatedDataSourcePicker {...props} />
  ) : (
    <DataSourcePickerWithHistory {...props} />
  );
}

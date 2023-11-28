import React from 'react';
import { DataSourcePicker as DeprecatedDataSourcePicker, } from '@grafana/runtime';
import { config } from 'app/core/config';
import { DataSourceDropdown } from './DataSourceDropdown';
/**
 * DataSourcePicker is a wrapper around the old DataSourcePicker and the new one.
 * Depending on the feature toggle, it will render the old or the new one.
 * Feature toggle: advancedDataSourcePicker
 */
export function DataSourcePicker(props) {
    return !config.featureToggles.advancedDataSourcePicker ? (React.createElement(DeprecatedDataSourcePicker, Object.assign({}, props))) : (React.createElement(DataSourceDropdown, Object.assign({}, props)));
}
//# sourceMappingURL=DataSourcePicker.js.map
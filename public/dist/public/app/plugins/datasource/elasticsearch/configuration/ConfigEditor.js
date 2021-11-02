import { __assign } from "tslib";
import React, { useEffect } from 'react';
import { Alert, DataSourceHttpSettings } from '@grafana/ui';
import { ElasticDetails } from './ElasticDetails';
import { LogsConfig } from './LogsConfig';
import { DataLinks } from './DataLinks';
import { config } from 'app/core/config';
import { coerceOptions, isValidOptions } from './utils';
export var ConfigEditor = function (props) {
    var originalOptions = props.options, onOptionsChange = props.onOptionsChange;
    var options = coerceOptions(originalOptions);
    useEffect(function () {
        if (!isValidOptions(originalOptions)) {
            onOptionsChange(coerceOptions(originalOptions));
        }
        // We can't enforce the eslint rule here because we only want to run this once.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (React.createElement(React.Fragment, null,
        options.access === 'direct' && (React.createElement(Alert, { title: "Deprecation Notice", severity: "warning" }, "Browser access mode in the Elasticsearch datasource is deprecated and will be removed in a future release.")),
        React.createElement(DataSourceHttpSettings, { defaultUrl: "http://localhost:9200", dataSourceConfig: options, showAccessOptions: true, onChange: onOptionsChange, sigV4AuthToggleEnabled: config.sigV4AuthEnabled }),
        React.createElement(ElasticDetails, { value: options, onChange: onOptionsChange }),
        React.createElement(LogsConfig, { value: options.jsonData, onChange: function (newValue) {
                return onOptionsChange(__assign(__assign({}, options), { jsonData: newValue }));
            } }),
        React.createElement(DataLinks, { value: options.jsonData.dataLinks, onChange: function (newValue) {
                onOptionsChange(__assign(__assign({}, options), { jsonData: __assign(__assign({}, options.jsonData), { dataLinks: newValue }) }));
            } })));
};
//# sourceMappingURL=ConfigEditor.js.map
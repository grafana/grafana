import { __assign } from "tslib";
import React from 'react';
import { AlertingSettings, DataSourceHttpSettings } from '@grafana/ui';
import { MaxLinesField } from './MaxLinesField';
import { DerivedFields } from './DerivedFields';
import { getAllAlertmanagerDataSources } from 'app/features/alerting/unified/utils/alertmanager';
var makeJsonUpdater = function (field) { return function (options, value) {
    var _a;
    return __assign(__assign({}, options), { jsonData: __assign(__assign({}, options.jsonData), (_a = {}, _a[field] = value, _a)) });
}; };
var setMaxLines = makeJsonUpdater('maxLines');
var setDerivedFields = makeJsonUpdater('derivedFields');
export var ConfigEditor = function (props) {
    var options = props.options, onOptionsChange = props.onOptionsChange;
    var alertmanagers = getAllAlertmanagerDataSources();
    return (React.createElement(React.Fragment, null,
        React.createElement(DataSourceHttpSettings, { defaultUrl: 'http://localhost:3100', dataSourceConfig: options, showAccessOptions: false, onChange: onOptionsChange }),
        React.createElement(AlertingSettings, { alertmanagerDataSources: alertmanagers, options: options, onOptionsChange: onOptionsChange }),
        React.createElement("div", { className: "gf-form-group" },
            React.createElement("div", { className: "gf-form-inline" },
                React.createElement("div", { className: "gf-form" },
                    React.createElement(MaxLinesField, { value: options.jsonData.maxLines || '', onChange: function (value) { return onOptionsChange(setMaxLines(options, value)); } })))),
        React.createElement(DerivedFields, { value: options.jsonData.derivedFields, onChange: function (value) { return onOptionsChange(setDerivedFields(options, value)); } })));
};
//# sourceMappingURL=ConfigEditor.js.map
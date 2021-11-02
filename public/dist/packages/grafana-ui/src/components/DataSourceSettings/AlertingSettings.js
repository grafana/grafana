import { __assign } from "tslib";
import React, { useMemo } from 'react';
import { Switch } from '../Forms/Legacy/Switch/Switch';
import { InlineField } from '../Forms/InlineField';
import { InlineFieldRow } from '../Forms/InlineFieldRow';
import { Select } from '../Select/Select';
export function AlertingSettings(_a) {
    var alertmanagerDataSources = _a.alertmanagerDataSources, options = _a.options, onOptionsChange = _a.onOptionsChange;
    var alertmanagerOptions = useMemo(function () {
        return alertmanagerDataSources.map(function (ds) { return ({
            label: ds.name,
            value: ds.uid,
            imgUrl: ds.meta.info.logos.small,
            meta: ds.meta,
        }); });
    }, [alertmanagerDataSources]);
    return (React.createElement(React.Fragment, null,
        React.createElement("h3", { className: "page-heading" }, "Alerting"),
        React.createElement("div", { className: "gf-form-group" },
            React.createElement("div", { className: "gf-form-inline" },
                React.createElement("div", { className: "gf-form" },
                    React.createElement(Switch, { label: "Manage alerts via Alerting UI", labelClass: "width-13", checked: options.jsonData.manageAlerts !== false, onChange: function (event) {
                            return onOptionsChange(__assign(__assign({}, options), { jsonData: __assign(__assign({}, options.jsonData), { manageAlerts: event.currentTarget.checked }) }));
                        } }))),
            React.createElement(InlineFieldRow, null,
                React.createElement(InlineField, { tooltip: "The alertmanager that manages alerts for this data source", label: "Alertmanager data source", labelWidth: 26 },
                    React.createElement(Select, { width: 29, menuShouldPortal: true, options: alertmanagerOptions, onChange: function (value) {
                            return onOptionsChange(__assign(__assign({}, options), { jsonData: __assign(__assign({}, options.jsonData), { alertmanagerUid: value === null || value === void 0 ? void 0 : value.value }) }));
                        }, value: options.jsonData.alertmanagerUid }))))));
}
//# sourceMappingURL=AlertingSettings.js.map
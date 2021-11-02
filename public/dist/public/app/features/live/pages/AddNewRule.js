import { __read } from "tslib";
import React, { useState } from 'react';
import { Input, Field, Button, ValuePicker, HorizontalGroup } from '@grafana/ui';
import { DataSourcePicker, getBackendSrv } from '@grafana/runtime';
import { AppEvents, LiveChannelScope } from '@grafana/data';
import appEvents from 'app/core/app_events';
var patternTypes = [
    {
        label: 'Data source',
        description: 'Configure a channel scoped to a data source instance',
        value: 'ds',
    },
    {
        label: 'Any',
        description: 'Enter an arbitray channel pattern',
        value: 'any',
    },
];
export function AddNewRule(_a) {
    var onRuleAdded = _a.onRuleAdded;
    var _b = __read(useState(), 2), patternType = _b[0], setPatternType = _b[1];
    var _c = __read(useState(), 2), pattern = _c[0], setPattern = _c[1];
    var _d = __read(useState(''), 2), patternPrefix = _d[0], setPatternPrefix = _d[1];
    var _e = __read(useState(), 2), datasource = _e[0], setDatasource = _e[1];
    var onSubmit = function () {
        if (!pattern) {
            appEvents.emit(AppEvents.alertError, ['Enter path']);
            return;
        }
        if (patternType === 'ds' && !patternPrefix.length) {
            appEvents.emit(AppEvents.alertError, ['Select datasource']);
            return;
        }
        getBackendSrv()
            .post("api/live/channel-rules", {
            pattern: patternPrefix + pattern,
            settings: {
                converter: {
                    type: 'jsonAuto',
                },
                frameOutputs: [
                    {
                        type: 'managedStream',
                    },
                ],
            },
        })
            .then(function (v) {
            console.log('ADDED', v);
            setPattern(undefined);
            setPatternType(undefined);
            onRuleAdded(v.rule);
        })
            .catch(function (e) {
            appEvents.emit(AppEvents.alertError, ['Error adding rule', e]);
            e.isHandled = true;
        });
    };
    if (patternType) {
        return (React.createElement("div", null,
            React.createElement(HorizontalGroup, null,
                patternType === 'any' && (React.createElement(Field, { label: "Pattern" },
                    React.createElement(Input, { value: pattern !== null && pattern !== void 0 ? pattern : '', onChange: function (e) { return setPattern(e.currentTarget.value); }, placeholder: "scope/namespace/path" }))),
                patternType === 'ds' && (React.createElement(React.Fragment, null,
                    React.createElement(Field, { label: "Data source" },
                        React.createElement(DataSourcePicker, { current: datasource, onChange: function (ds) {
                                setDatasource(ds);
                                setPatternPrefix(LiveChannelScope.DataSource + "/" + ds.uid + "/");
                            } })),
                    React.createElement(Field, { label: "Path" },
                        React.createElement(Input, { value: pattern !== null && pattern !== void 0 ? pattern : '', onChange: function (e) { return setPattern(e.currentTarget.value); }, placeholder: "path" })))),
                React.createElement(Field, { label: "" },
                    React.createElement(Button, { onClick: onSubmit, variant: (pattern === null || pattern === void 0 ? void 0 : pattern.length) ? 'primary' : 'secondary' }, "Add")),
                React.createElement(Field, { label: "" },
                    React.createElement(Button, { variant: "secondary", onClick: function () { return setPatternType(undefined); } }, "Cancel")))));
    }
    return (React.createElement("div", null,
        React.createElement(ValuePicker, { label: "Add channel rule", variant: "secondary", size: "md", icon: "plus", menuPlacement: "auto", isFullWidth: false, options: patternTypes, onChange: function (v) { return setPatternType(v.value); } })));
}
//# sourceMappingURL=AddNewRule.js.map
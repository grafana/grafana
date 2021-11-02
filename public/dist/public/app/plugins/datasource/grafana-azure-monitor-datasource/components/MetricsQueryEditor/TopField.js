import { __read } from "tslib";
import React, { useCallback, useState } from 'react';
import { Input } from '@grafana/ui';
import { Field } from '../Field';
import { setTop } from './setQueryValue';
var TopField = function (_a) {
    var _b, _c;
    var onQueryChange = _a.onQueryChange, query = _a.query;
    var _d = __read(useState((_c = (_b = query.azureMonitor) === null || _b === void 0 ? void 0 : _b.top) !== null && _c !== void 0 ? _c : ''), 2), value = _d[0], setValue = _d[1];
    // As calling onQueryChange initiates a the datasource refresh, we only want to call it once
    // the field loses focus
    var handleChange = useCallback(function (ev) {
        if (ev.target instanceof HTMLInputElement) {
            setValue(ev.target.value);
        }
    }, []);
    var handleBlur = useCallback(function () {
        var newQuery = setTop(query, value);
        onQueryChange(newQuery);
    }, [onQueryChange, query, value]);
    return (React.createElement(Field, { label: "Top" },
        React.createElement(Input, { id: "azure-monitor-metrics-top-field", value: value, onChange: handleChange, onBlur: handleBlur, width: 16 })));
};
export default TopField;
//# sourceMappingURL=TopField.js.map
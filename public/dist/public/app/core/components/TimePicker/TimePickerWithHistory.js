import { __assign, __read, __spreadArray } from "tslib";
import React from 'react';
import { LocalStorageValueProvider } from '../LocalStorageValueProvider';
import { isDateTime, toUtc } from '@grafana/data';
import { TimeRangePicker } from '@grafana/ui';
var LOCAL_STORAGE_KEY = 'grafana.dashboard.timepicker.history';
export var TimePickerWithHistory = function (props) {
    return (React.createElement(LocalStorageValueProvider, { storageKey: LOCAL_STORAGE_KEY, defaultValue: [] }, function (values, onSaveToStore) {
        return (React.createElement(TimeRangePicker, __assign({}, props, { history: convertIfJson(values), onChange: function (value) {
                onAppendToHistory(value, values, onSaveToStore);
                props.onChange(value);
            } })));
    }));
};
function convertIfJson(history) {
    return history.map(function (time) {
        if (isDateTime(time.from)) {
            return time;
        }
        return {
            from: toUtc(time.from),
            to: toUtc(time.to),
            raw: time.raw,
        };
    });
}
function onAppendToHistory(toAppend, values, onSaveToStore) {
    if (!isAbsolute(toAppend)) {
        return;
    }
    var toStore = limit(__spreadArray([toAppend], __read(values), false));
    onSaveToStore(toStore);
}
function isAbsolute(value) {
    return isDateTime(value.raw.from) || isDateTime(value.raw.to);
}
function limit(value) {
    return value.slice(0, 4);
}
//# sourceMappingURL=TimePickerWithHistory.js.map
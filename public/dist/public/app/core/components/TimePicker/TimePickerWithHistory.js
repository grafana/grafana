import { uniqBy } from 'lodash';
import React from 'react';
import { isDateTime, rangeUtil } from '@grafana/data';
import { TimeRangePicker } from '@grafana/ui';
import { LocalStorageValueProvider } from '../LocalStorageValueProvider';
const LOCAL_STORAGE_KEY = 'grafana.dashboard.timepicker.history';
export const TimePickerWithHistory = (props) => {
    return (React.createElement(LocalStorageValueProvider, { storageKey: LOCAL_STORAGE_KEY, defaultValue: [] }, (rawValues, onSaveToStore) => {
        const values = migrateHistory(rawValues);
        const history = deserializeHistory(values);
        return (React.createElement(TimeRangePicker, Object.assign({}, props, { history: history, onChange: (value) => {
                onAppendToHistory(value, values, onSaveToStore);
                props.onChange(value);
            } })));
    }));
};
function deserializeHistory(values) {
    // The history is saved in UTC and with the default date format, so we need to pass those values to the convertRawToRange
    return values.map((item) => rangeUtil.convertRawToRange(item, 'utc', undefined, 'YYYY-MM-DD HH:mm:ss'));
}
function migrateHistory(values) {
    return values.map((item) => {
        const fromValue = typeof item.from === 'string' ? item.from : item.from.toISOString();
        const toValue = typeof item.to === 'string' ? item.to : item.to.toISOString();
        return {
            from: fromValue,
            to: toValue,
        };
    });
}
function onAppendToHistory(newTimeRange, values, onSaveToStore) {
    if (!isAbsolute(newTimeRange)) {
        return;
    }
    // Convert DateTime objects to strings
    const toAppend = {
        from: typeof newTimeRange.raw.from === 'string' ? newTimeRange.raw.from : newTimeRange.raw.from.toISOString(),
        to: typeof newTimeRange.raw.to === 'string' ? newTimeRange.raw.to : newTimeRange.raw.to.toISOString(),
    };
    const toStore = limit([toAppend, ...values]);
    onSaveToStore(toStore);
}
function isAbsolute(value) {
    return isDateTime(value.raw.from) || isDateTime(value.raw.to);
}
function limit(value) {
    return uniqBy(value, (v) => v.from + v.to).slice(0, 4);
}
//# sourceMappingURL=TimePickerWithHistory.js.map
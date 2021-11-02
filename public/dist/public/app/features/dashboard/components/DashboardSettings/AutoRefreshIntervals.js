import { __read, __spreadArray } from "tslib";
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Input, defaultIntervals, Field } from '@grafana/ui';
import { getTimeSrv } from '../../services/TimeSrv';
export var AutoRefreshIntervals = function (_a) {
    var refreshIntervals = _a.refreshIntervals, onRefreshIntervalChange = _a.onRefreshIntervalChange, _b = _a.getIntervalsFunc, getIntervalsFunc = _b === void 0 ? getValidIntervals : _b, _c = _a.validateIntervalsFunc, validateIntervalsFunc = _c === void 0 ? validateIntervals : _c;
    var _d = __read(useState(getIntervalsFunc(refreshIntervals !== null && refreshIntervals !== void 0 ? refreshIntervals : defaultIntervals)), 2), intervals = _d[0], setIntervals = _d[1];
    var _e = __read(useState(null), 2), invalidIntervalsMessage = _e[0], setInvalidIntervalsMessage = _e[1];
    useEffect(function () {
        var intervals = getIntervalsFunc(refreshIntervals !== null && refreshIntervals !== void 0 ? refreshIntervals : defaultIntervals);
        setIntervals(intervals);
    }, [getIntervalsFunc, refreshIntervals]);
    var intervalsString = useMemo(function () {
        if (!Array.isArray(intervals)) {
            return '';
        }
        return intervals.join(',');
    }, [intervals]);
    var onIntervalsChange = useCallback(function (event) {
        var newIntervals = event.currentTarget.value ? event.currentTarget.value.split(',') : [];
        setIntervals(newIntervals);
    }, [setIntervals]);
    var onIntervalsBlur = useCallback(function (event) {
        var invalidMessage = validateIntervalsFunc(intervals);
        if (invalidMessage === null) {
            // only refresh dashboard JSON if intervals are valid
            onRefreshIntervalChange(getIntervalsFunc(intervals));
        }
        setInvalidIntervalsMessage(invalidMessage);
    }, [getIntervalsFunc, intervals, onRefreshIntervalChange, validateIntervalsFunc]);
    return (React.createElement(Field, { label: "Auto refresh", description: "Define the auto refresh intervals that should be available in the auto refresh list.", error: invalidIntervalsMessage, invalid: !!invalidIntervalsMessage },
        React.createElement(Input, { id: "auto-refresh-input", invalid: !!invalidIntervalsMessage, value: intervalsString, onChange: onIntervalsChange, onBlur: onIntervalsBlur })));
};
export var validateIntervals = function (intervals, dependencies) {
    if (dependencies === void 0) { dependencies = { getTimeSrv: getTimeSrv }; }
    try {
        getValidIntervals(intervals, dependencies);
        return null;
    }
    catch (err) {
        return err.message;
    }
};
export var getValidIntervals = function (intervals, dependencies) {
    if (dependencies === void 0) { dependencies = { getTimeSrv: getTimeSrv }; }
    var cleanIntervals = intervals.filter(function (i) { return i.trim() !== ''; }).map(function (interval) { return interval.replace(/\s+/g, ''); });
    return __spreadArray([], __read(new Set(dependencies.getTimeSrv().getValidIntervals(cleanIntervals))), false);
};
//# sourceMappingURL=AutoRefreshIntervals.js.map
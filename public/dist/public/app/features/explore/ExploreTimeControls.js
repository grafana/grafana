import { __assign, __extends } from "tslib";
// Libaries
import React, { Component } from 'react';
import { dateTimeForTimeZone, dateMath } from '@grafana/data';
// State
// Components
import { TimeSyncButton } from './TimeSyncButton';
import { TimePickerWithHistory } from 'app/core/components/TimePicker/TimePickerWithHistory';
// Utils & Services
import { getShiftedTimeRange, getZoomedTimeRange } from 'app/core/utils/timePicker';
var ExploreTimeControls = /** @class */ (function (_super) {
    __extends(ExploreTimeControls, _super);
    function ExploreTimeControls() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.onMoveTimePicker = function (direction) {
            var _a = _this.props, range = _a.range, onChangeTime = _a.onChangeTime, timeZone = _a.timeZone;
            var _b = getShiftedTimeRange(direction, range), from = _b.from, to = _b.to;
            var nextTimeRange = {
                from: dateTimeForTimeZone(timeZone, from),
                to: dateTimeForTimeZone(timeZone, to),
            };
            onChangeTime(nextTimeRange);
        };
        _this.onMoveForward = function () { return _this.onMoveTimePicker(1); };
        _this.onMoveBack = function () { return _this.onMoveTimePicker(-1); };
        _this.onChangeTimePicker = function (timeRange) {
            var adjustedFrom = dateMath.isMathString(timeRange.raw.from) ? timeRange.raw.from : timeRange.from;
            var adjustedTo = dateMath.isMathString(timeRange.raw.to) ? timeRange.raw.to : timeRange.to;
            _this.props.onChangeTime({
                from: adjustedFrom,
                to: adjustedTo,
            });
        };
        _this.onZoom = function () {
            var _a = _this.props, range = _a.range, onChangeTime = _a.onChangeTime, timeZone = _a.timeZone;
            var _b = getZoomedTimeRange(range, 2), from = _b.from, to = _b.to;
            var nextTimeRange = {
                from: dateTimeForTimeZone(timeZone, from),
                to: dateTimeForTimeZone(timeZone, to),
            };
            onChangeTime(nextTimeRange);
        };
        return _this;
    }
    ExploreTimeControls.prototype.render = function () {
        var _a = this.props, range = _a.range, timeZone = _a.timeZone, fiscalYearStartMonth = _a.fiscalYearStartMonth, splitted = _a.splitted, syncedTimes = _a.syncedTimes, onChangeTimeSync = _a.onChangeTimeSync, hideText = _a.hideText, onChangeTimeZone = _a.onChangeTimeZone, onChangeFiscalYearStartMonth = _a.onChangeFiscalYearStartMonth;
        var timeSyncButton = splitted ? React.createElement(TimeSyncButton, { onClick: onChangeTimeSync, isSynced: syncedTimes }) : undefined;
        var timePickerCommonProps = {
            value: range,
            timeZone: timeZone,
            fiscalYearStartMonth: fiscalYearStartMonth,
            onMoveBackward: this.onMoveBack,
            onMoveForward: this.onMoveForward,
            onZoom: this.onZoom,
            hideText: hideText,
        };
        return (React.createElement(TimePickerWithHistory, __assign({}, timePickerCommonProps, { timeSyncButton: timeSyncButton, isSynced: syncedTimes, onChange: this.onChangeTimePicker, onChangeTimeZone: onChangeTimeZone, onChangeFiscalYearStartMonth: onChangeFiscalYearStartMonth })));
    };
    return ExploreTimeControls;
}(Component));
export { ExploreTimeControls };
//# sourceMappingURL=ExploreTimeControls.js.map
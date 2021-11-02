import { __extends } from "tslib";
// Libraries
import React, { Component } from 'react';
import { dateMath } from '@grafana/data';
import { TimeRangeUpdatedEvent } from '@grafana/runtime';
// Components
import { defaultIntervals, RefreshPicker, ToolbarButtonRow } from '@grafana/ui';
import { TimePickerWithHistory } from 'app/core/components/TimePicker/TimePickerWithHistory';
// Utils & Services
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { appEvents } from 'app/core/core';
import { ShiftTimeEvent, ShiftTimeEventPayload, ZoomOutEvent } from '../../../../types/events';
var DashNavTimeControls = /** @class */ (function (_super) {
    __extends(DashNavTimeControls, _super);
    function DashNavTimeControls() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.onChangeRefreshInterval = function (interval) {
            getTimeSrv().setAutoRefresh(interval);
            _this.forceUpdate();
        };
        _this.onRefresh = function () {
            getTimeSrv().refreshDashboard();
            return Promise.resolve();
        };
        _this.onMoveBack = function () {
            appEvents.publish(new ShiftTimeEvent(ShiftTimeEventPayload.Left));
        };
        _this.onMoveForward = function () {
            appEvents.publish(new ShiftTimeEvent(ShiftTimeEventPayload.Right));
        };
        _this.onChangeTimePicker = function (timeRange) {
            var dashboard = _this.props.dashboard;
            var panel = dashboard.timepicker;
            var hasDelay = panel.nowDelay && timeRange.raw.to === 'now';
            var adjustedFrom = dateMath.isMathString(timeRange.raw.from) ? timeRange.raw.from : timeRange.from;
            var adjustedTo = dateMath.isMathString(timeRange.raw.to) ? timeRange.raw.to : timeRange.to;
            var nextRange = {
                from: adjustedFrom,
                to: hasDelay ? 'now-' + panel.nowDelay : adjustedTo,
            };
            getTimeSrv().setTime(nextRange);
        };
        _this.onChangeTimeZone = function (timeZone) {
            _this.props.dashboard.timezone = timeZone;
            _this.props.onChangeTimeZone(timeZone);
            _this.onRefresh();
        };
        _this.onChangeFiscalYearStartMonth = function (month) {
            _this.props.dashboard.fiscalYearStartMonth = month;
            _this.onRefresh();
        };
        _this.onZoom = function () {
            appEvents.publish(new ZoomOutEvent(2));
        };
        return _this;
    }
    DashNavTimeControls.prototype.componentDidMount = function () {
        var _this = this;
        this.sub = this.props.dashboard.events.subscribe(TimeRangeUpdatedEvent, function () { return _this.forceUpdate(); });
    };
    DashNavTimeControls.prototype.componentWillUnmount = function () {
        var _a;
        (_a = this.sub) === null || _a === void 0 ? void 0 : _a.unsubscribe();
    };
    DashNavTimeControls.prototype.render = function () {
        var _a;
        var dashboard = this.props.dashboard;
        var refresh_intervals = dashboard.timepicker.refresh_intervals;
        var intervals = getTimeSrv().getValidIntervals(refresh_intervals || defaultIntervals);
        var timePickerValue = getTimeSrv().timeRange();
        var timeZone = dashboard.getTimezone();
        var fiscalYearStartMonth = dashboard.fiscalYearStartMonth;
        var hideIntervalPicker = (_a = dashboard.panelInEdit) === null || _a === void 0 ? void 0 : _a.isEditing;
        return (React.createElement(ToolbarButtonRow, null,
            React.createElement(TimePickerWithHistory, { value: timePickerValue, onChange: this.onChangeTimePicker, timeZone: timeZone, fiscalYearStartMonth: fiscalYearStartMonth, onMoveBackward: this.onMoveBack, onMoveForward: this.onMoveForward, onZoom: this.onZoom, onChangeTimeZone: this.onChangeTimeZone, onChangeFiscalYearStartMonth: this.onChangeFiscalYearStartMonth }),
            React.createElement(RefreshPicker, { onIntervalChanged: this.onChangeRefreshInterval, onRefresh: this.onRefresh, value: dashboard.refresh, intervals: intervals, tooltip: "Refresh dashboard", noIntervalPicker: hideIntervalPicker })));
    };
    return DashNavTimeControls;
}(Component));
export { DashNavTimeControls };
//# sourceMappingURL=DashNavTimeControls.js.map
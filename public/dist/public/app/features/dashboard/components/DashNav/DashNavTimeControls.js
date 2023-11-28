import React, { Component } from 'react';
import { dateMath } from '@grafana/data';
import { TimeRangeUpdatedEvent } from '@grafana/runtime';
import { defaultIntervals, RefreshPicker } from '@grafana/ui';
import { TimePickerWithHistory } from 'app/core/components/TimePicker/TimePickerWithHistory';
import { appEvents } from 'app/core/core';
import { t } from 'app/core/internationalization';
import { AutoRefreshInterval } from 'app/core/services/context_srv';
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { ShiftTimeEvent, ShiftTimeEventDirection, ZoomOutEvent } from '../../../../types/events';
export class DashNavTimeControls extends Component {
    constructor() {
        super(...arguments);
        this.onChangeRefreshInterval = (interval) => {
            getTimeSrv().setAutoRefresh(interval);
            this.forceUpdate();
        };
        this.onRefresh = () => {
            getTimeSrv().refreshTimeModel();
            return Promise.resolve();
        };
        this.onMoveBack = () => {
            appEvents.publish(new ShiftTimeEvent({ direction: ShiftTimeEventDirection.Left }));
        };
        this.onMoveForward = () => {
            appEvents.publish(new ShiftTimeEvent({ direction: ShiftTimeEventDirection.Right }));
        };
        this.onChangeTimePicker = (timeRange) => {
            const { dashboard } = this.props;
            const panel = dashboard.timepicker;
            const hasDelay = panel.nowDelay && timeRange.raw.to === 'now';
            const adjustedFrom = dateMath.isMathString(timeRange.raw.from) ? timeRange.raw.from : timeRange.from;
            const adjustedTo = dateMath.isMathString(timeRange.raw.to) ? timeRange.raw.to : timeRange.to;
            const nextRange = {
                from: adjustedFrom,
                to: hasDelay ? 'now-' + panel.nowDelay : adjustedTo,
            };
            getTimeSrv().setTime(nextRange);
        };
        this.onChangeTimeZone = (timeZone) => {
            this.props.dashboard.timezone = timeZone;
            this.props.onChangeTimeZone(timeZone);
            this.onRefresh();
        };
        this.onChangeFiscalYearStartMonth = (month) => {
            this.props.dashboard.fiscalYearStartMonth = month;
            this.onRefresh();
        };
        this.onZoom = () => {
            appEvents.publish(new ZoomOutEvent({ scale: 2 }));
        };
    }
    componentDidMount() {
        this.sub = this.props.dashboard.events.subscribe(TimeRangeUpdatedEvent, () => this.forceUpdate());
    }
    componentWillUnmount() {
        var _a;
        (_a = this.sub) === null || _a === void 0 ? void 0 : _a.unsubscribe();
    }
    render() {
        var _a;
        const { dashboard, isOnCanvas } = this.props;
        const { refresh_intervals } = dashboard.timepicker;
        const intervals = getTimeSrv().getValidIntervals(refresh_intervals || defaultIntervals);
        const timePickerValue = getTimeSrv().timeRange();
        const timeZone = dashboard.getTimezone();
        const fiscalYearStartMonth = dashboard.fiscalYearStartMonth;
        const hideIntervalPicker = (_a = dashboard.panelInEdit) === null || _a === void 0 ? void 0 : _a.isEditing;
        let text = undefined;
        if (dashboard.refresh === AutoRefreshInterval) {
            text = getTimeSrv().getAutoRefreshInteval().interval;
        }
        return (React.createElement(React.Fragment, null,
            React.createElement(TimePickerWithHistory, { value: timePickerValue, onChange: this.onChangeTimePicker, timeZone: timeZone, fiscalYearStartMonth: fiscalYearStartMonth, onMoveBackward: this.onMoveBack, onMoveForward: this.onMoveForward, onZoom: this.onZoom, onChangeTimeZone: this.onChangeTimeZone, onChangeFiscalYearStartMonth: this.onChangeFiscalYearStartMonth, isOnCanvas: isOnCanvas }),
            React.createElement(RefreshPicker, { onIntervalChanged: this.onChangeRefreshInterval, onRefresh: this.onRefresh, value: dashboard.refresh, intervals: intervals, isOnCanvas: isOnCanvas, tooltip: t('dashboard.toolbar.refresh', 'Refresh dashboard'), noIntervalPicker: hideIntervalPicker, showAutoInterval: true, text: text })));
    }
}
//# sourceMappingURL=DashNavTimeControls.js.map
import { __extends } from "tslib";
import React, { PureComponent } from 'react';
import { Input, TimeZonePicker, Field, Switch, CollapsableSection, WeekStartPicker } from '@grafana/ui';
import { rangeUtil } from '@grafana/data';
import { isEmpty } from 'lodash';
import { selectors } from '@grafana/e2e-selectors';
import { AutoRefreshIntervals } from './AutoRefreshIntervals';
var TimePickerSettings = /** @class */ (function (_super) {
    __extends(TimePickerSettings, _super);
    function TimePickerSettings() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.state = { isNowDelayValid: true };
        _this.onNowDelayChange = function (event) {
            var value = event.currentTarget.value;
            if (isEmpty(value)) {
                _this.setState({ isNowDelayValid: true });
                return _this.props.onNowDelayChange(value);
            }
            if (rangeUtil.isValidTimeSpan(value)) {
                _this.setState({ isNowDelayValid: true });
                return _this.props.onNowDelayChange(value);
            }
            _this.setState({ isNowDelayValid: false });
        };
        _this.onHideTimePickerChange = function () {
            _this.props.onHideTimePickerChange(!_this.props.timePickerHidden);
        };
        _this.onLiveNowChange = function () {
            _this.props.onLiveNowChange(!_this.props.liveNow);
        };
        _this.onTimeZoneChange = function (timeZone) {
            if (typeof timeZone !== 'string') {
                return;
            }
            _this.props.onTimeZoneChange(timeZone);
        };
        _this.onWeekStartChange = function (weekStart) {
            _this.props.onWeekStartChange(weekStart);
        };
        return _this;
    }
    TimePickerSettings.prototype.render = function () {
        return (React.createElement(CollapsableSection, { label: "Time options", isOpen: true },
            React.createElement(Field, { label: "Timezone", "aria-label": selectors.components.TimeZonePicker.container },
                React.createElement(TimeZonePicker, { includeInternal: true, value: this.props.timezone, onChange: this.onTimeZoneChange, width: 40 })),
            React.createElement(Field, { label: "Week start", "aria-label": selectors.components.WeekStartPicker.container },
                React.createElement(WeekStartPicker, { width: 40, value: this.props.weekStart, onChange: this.onWeekStartChange })),
            React.createElement(AutoRefreshIntervals, { refreshIntervals: this.props.refreshIntervals, onRefreshIntervalChange: this.props.onRefreshIntervalChange }),
            React.createElement(Field, { label: "Now delay now", description: "Enter 1m to ignore the last minute. It might contain incomplete metrics." },
                React.createElement(Input, { invalid: !this.state.isNowDelayValid, placeholder: "0m", onChange: this.onNowDelayChange, defaultValue: this.props.nowDelay })),
            React.createElement(Field, { label: "Hide time picker" },
                React.createElement(Switch, { id: "hide-time-picker-toggle", value: !!this.props.timePickerHidden, onChange: this.onHideTimePickerChange })),
            React.createElement(Field, { label: "Refresh live dashboards", description: "Continuously re-draw panels where the time range references 'now'" },
                React.createElement(Switch, { id: "refresh-live-dashboards-toggle", value: !!this.props.liveNow, onChange: this.onLiveNowChange }))));
    };
    return TimePickerSettings;
}(PureComponent));
export { TimePickerSettings };
//# sourceMappingURL=TimePickerSettings.js.map
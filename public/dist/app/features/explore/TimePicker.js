import * as tslib_1 from "tslib";
import React, { PureComponent } from 'react';
import moment from 'moment';
import * as dateMath from 'app/core/utils/datemath';
import * as rangeUtil from 'app/core/utils/rangeutil';
var DATE_FORMAT = 'YYYY-MM-DD HH:mm:ss';
export var DEFAULT_RANGE = {
    from: 'now-6h',
    to: 'now',
};
/**
 * Return a human-editable string of either relative (inludes "now") or absolute local time (in the shape of DATE_FORMAT).
 * @param value Epoch or relative time
 */
export function parseTime(value, isUtc, ensureString) {
    if (isUtc === void 0) { isUtc = false; }
    if (ensureString === void 0) { ensureString = false; }
    if (moment.isMoment(value)) {
        if (ensureString) {
            return value.format(DATE_FORMAT);
        }
        return value;
    }
    if (value.indexOf('now') !== -1) {
        return value;
    }
    var time = value;
    // Possible epoch
    if (!isNaN(time)) {
        time = parseInt(time, 10);
    }
    time = isUtc ? moment.utc(time) : moment(time);
    return time.format(DATE_FORMAT);
}
/**
 * TimePicker with dropdown menu for relative dates.
 *
 * Initialize with a range that is either based on relative time strings,
 * or on Moment objects.
 * Internally the component needs to keep a string representation in `fromRaw`
 * and `toRaw` for the controlled inputs.
 * When a time is picked, `onChangeTime` is called with the new range that
 * is again based on relative time strings or Moment objects.
 */
var TimePicker = /** @class */ (function (_super) {
    tslib_1.__extends(TimePicker, _super);
    function TimePicker(props) {
        var _this = _super.call(this, props) || this;
        _this.handleChangeFrom = function (e) {
            _this.setState({
                fromRaw: e.target.value,
            });
        };
        _this.handleChangeTo = function (e) {
            _this.setState({
                toRaw: e.target.value,
            });
        };
        _this.handleClickApply = function () {
            var onChangeTime = _this.props.onChangeTime;
            var range;
            _this.setState(function (state) {
                var _a = _this.state, toRaw = _a.toRaw, fromRaw = _a.fromRaw;
                range = {
                    from: dateMath.parse(fromRaw, false),
                    to: dateMath.parse(toRaw, true),
                };
                var rangeString = rangeUtil.describeTimeRange(range);
                return {
                    isOpen: false,
                    rangeString: rangeString,
                };
            }, function () {
                if (onChangeTime) {
                    onChangeTime(range);
                }
            });
        };
        _this.handleClickLeft = function () { return _this.move(-1); };
        _this.handleClickPicker = function () {
            _this.setState(function (state) { return ({
                isOpen: !state.isOpen,
            }); });
        };
        _this.handleClickRight = function () { return _this.move(1); };
        _this.handleClickRefresh = function () { };
        _this.handleClickRelativeOption = function (range) {
            var onChangeTime = _this.props.onChangeTime;
            var rangeString = rangeUtil.describeTimeRange(range);
            _this.setState({
                toRaw: range.to,
                fromRaw: range.from,
                isOpen: false,
                rangeString: rangeString,
            }, function () {
                if (onChangeTime) {
                    onChangeTime(range);
                }
            });
        };
        _this.dropdownRef = function (el) {
            _this.dropdownEl = el;
        };
        _this.state = {
            isOpen: props.isOpen,
            isUtc: props.isUtc,
            rangeString: '',
            fromRaw: '',
            toRaw: '',
            initialRange: DEFAULT_RANGE,
            refreshInterval: '',
        };
        return _this;
    } //Temp solution... How do detect if ds supports table format?
    TimePicker.getDerivedStateFromProps = function (props, state) {
        if (state.initialRange && state.initialRange === props.range) {
            return state;
        }
        var from = props.range ? props.range.from : DEFAULT_RANGE.from;
        var to = props.range ? props.range.to : DEFAULT_RANGE.to;
        // Ensure internal string format
        var fromRaw = parseTime(from, props.isUtc, true);
        var toRaw = parseTime(to, props.isUtc, true);
        var range = {
            from: fromRaw,
            to: toRaw,
        };
        return tslib_1.__assign({}, state, { fromRaw: fromRaw,
            toRaw: toRaw, initialRange: props.range, rangeString: rangeUtil.describeTimeRange(range) });
    };
    TimePicker.prototype.move = function (direction, scanning) {
        var onChangeTime = this.props.onChangeTime;
        var _a = this.state, fromRaw = _a.fromRaw, toRaw = _a.toRaw;
        var from = dateMath.parse(fromRaw, false);
        var to = dateMath.parse(toRaw, true);
        var step = scanning ? 1 : 2;
        var timespan = (to.valueOf() - from.valueOf()) / step;
        var nextTo, nextFrom;
        if (direction === -1) {
            nextTo = to.valueOf() - timespan;
            nextFrom = from.valueOf() - timespan;
        }
        else if (direction === 1) {
            nextTo = to.valueOf() + timespan;
            nextFrom = from.valueOf() + timespan;
            if (nextTo > Date.now() && to < Date.now()) {
                nextTo = Date.now();
                nextFrom = from.valueOf();
            }
        }
        else {
            nextTo = to.valueOf();
            nextFrom = from.valueOf();
        }
        var nextRange = {
            from: moment(nextFrom),
            to: moment(nextTo),
        };
        var nextTimeRange = {
            raw: nextRange,
            from: nextRange.from,
            to: nextRange.to,
        };
        this.setState({
            rangeString: rangeUtil.describeTimeRange(nextRange),
            fromRaw: nextRange.from.format(DATE_FORMAT),
            toRaw: nextRange.to.format(DATE_FORMAT),
        }, function () {
            onChangeTime(nextTimeRange, scanning);
        });
        return nextRange;
    };
    TimePicker.prototype.getTimeOptions = function () {
        return rangeUtil.getRelativeTimesList({}, this.state.rangeString);
    };
    TimePicker.prototype.renderDropdown = function () {
        var _this = this;
        var _a = this.state, fromRaw = _a.fromRaw, isOpen = _a.isOpen, toRaw = _a.toRaw;
        if (!isOpen) {
            return null;
        }
        var timeOptions = this.getTimeOptions();
        return (React.createElement("div", { ref: this.dropdownRef, className: "gf-timepicker-dropdown" },
            React.createElement("div", { className: "popover-box" },
                React.createElement("div", { className: "popover-box__header" },
                    React.createElement("span", { className: "popover-box__title" }, "Quick ranges")),
                React.createElement("div", { className: "popover-box__body gf-timepicker-relative-section" }, Object.keys(timeOptions).map(function (section) {
                    var group = timeOptions[section];
                    return (React.createElement("ul", { key: section }, group.map(function (option) { return (React.createElement("li", { className: option.active ? 'active' : '', key: option.display },
                        React.createElement("a", { onClick: function () { return _this.handleClickRelativeOption(option); } }, option.display))); })));
                }))),
            React.createElement("div", { className: "popover-box" },
                React.createElement("div", { className: "popover-box__header" },
                    React.createElement("span", { className: "popover-box__title" }, "Custom range")),
                React.createElement("div", { className: "popover-box__body gf-timepicker-absolute-section" },
                    React.createElement("label", { className: "small" }, "From:"),
                    React.createElement("div", { className: "gf-form-inline" },
                        React.createElement("div", { className: "gf-form max-width-28" },
                            React.createElement("input", { type: "text", className: "gf-form-input input-large timepicker-from", value: fromRaw, onChange: this.handleChangeFrom }))),
                    React.createElement("label", { className: "small" }, "To:"),
                    React.createElement("div", { className: "gf-form-inline" },
                        React.createElement("div", { className: "gf-form max-width-28" },
                            React.createElement("input", { type: "text", className: "gf-form-input input-large timepicker-to", value: toRaw, onChange: this.handleChangeTo }))),
                    React.createElement("div", { className: "gf-form" },
                        React.createElement("button", { className: "btn gf-form-btn btn-secondary", onClick: this.handleClickApply }, "Apply"))))));
    };
    TimePicker.prototype.render = function () {
        var _a = this.state, isUtc = _a.isUtc, rangeString = _a.rangeString, refreshInterval = _a.refreshInterval;
        return (React.createElement("div", { className: "timepicker" },
            React.createElement("div", { className: "navbar-buttons" },
                React.createElement("button", { className: "btn navbar-button navbar-button--tight timepicker-left", onClick: this.handleClickLeft },
                    React.createElement("i", { className: "fa fa-chevron-left" })),
                React.createElement("button", { className: "btn navbar-button gf-timepicker-nav-btn", onClick: this.handleClickPicker },
                    React.createElement("i", { className: "fa fa-clock-o" }),
                    React.createElement("span", { className: "timepicker-rangestring" }, rangeString),
                    isUtc ? React.createElement("span", { className: "gf-timepicker-utc" }, "UTC") : null,
                    refreshInterval ? React.createElement("span", { className: "text-warning" },
                        "\u00A0 Refresh every ",
                        refreshInterval) : null),
                React.createElement("button", { className: "btn navbar-button navbar-button--tight timepicker-right", onClick: this.handleClickRight },
                    React.createElement("i", { className: "fa fa-chevron-right" }))),
            this.renderDropdown()));
    };
    return TimePicker;
}(PureComponent));
export default TimePicker;
//# sourceMappingURL=TimePicker.js.map
import { __extends } from "tslib";
import React, { PureComponent } from 'react';
import { ButtonSelect } from '../Dropdown/ButtonSelect';
import { ButtonGroup, ToolbarButton } from '../Button';
import { selectors } from '@grafana/e2e-selectors';
// Default intervals used in the refresh picker component
export var defaultIntervals = ['5s', '10s', '30s', '1m', '5m', '15m', '30m', '1h', '2h', '1d'];
var RefreshPicker = /** @class */ (function (_super) {
    __extends(RefreshPicker, _super);
    function RefreshPicker(props) {
        var _this = _super.call(this, props) || this;
        _this.onChangeSelect = function (item) {
            var onIntervalChanged = _this.props.onIntervalChanged;
            if (onIntervalChanged) {
                // @ts-ignore
                onIntervalChanged(item.value);
            }
        };
        return _this;
    }
    RefreshPicker.prototype.getVariant = function () {
        if (this.props.isLive) {
            return 'primary';
        }
        if (this.props.isLoading) {
            return 'destructive';
        }
        if (this.props.primary) {
            return 'primary';
        }
        return 'default';
    };
    RefreshPicker.prototype.render = function () {
        var _a = this.props, onRefresh = _a.onRefresh, intervals = _a.intervals, tooltip = _a.tooltip, value = _a.value, text = _a.text, isLoading = _a.isLoading, noIntervalPicker = _a.noIntervalPicker;
        var currentValue = value || '';
        var variant = this.getVariant();
        var options = intervalsToOptions({ intervals: intervals });
        var option = options.find(function (_a) {
            var value = _a.value;
            return value === currentValue;
        });
        var selectedValue = option || RefreshPicker.offOption;
        if (selectedValue.label === RefreshPicker.offOption.label) {
            selectedValue = { value: '' };
        }
        return (React.createElement(ButtonGroup, { className: "refresh-picker" },
            React.createElement(ToolbarButton, { tooltip: tooltip, onClick: onRefresh, variant: variant, icon: isLoading ? 'fa fa-spinner' : 'sync', "aria-label": selectors.components.RefreshPicker.runButton }, text),
            !noIntervalPicker && (React.createElement(ButtonSelect, { value: selectedValue, options: options, onChange: this.onChangeSelect, variant: variant, "aria-label": selectors.components.RefreshPicker.intervalButton }))));
    };
    RefreshPicker.offOption = { label: 'Off', value: '' };
    RefreshPicker.liveOption = { label: 'Live', value: 'LIVE' };
    RefreshPicker.isLive = function (refreshInterval) { return refreshInterval === RefreshPicker.liveOption.value; };
    return RefreshPicker;
}(PureComponent));
export { RefreshPicker };
export function intervalsToOptions(_a) {
    var _b = _a === void 0 ? {} : _a, _c = _b.intervals, intervals = _c === void 0 ? defaultIntervals : _c;
    var intervalsOrDefault = intervals || defaultIntervals;
    var options = intervalsOrDefault.map(function (interval) { return ({ label: interval, value: interval }); });
    options.unshift(RefreshPicker.offOption);
    return options;
}
//# sourceMappingURL=RefreshPicker.js.map
import { __extends } from "tslib";
import React, { PureComponent } from 'react';
import { difference } from 'lodash';
import { Select } from '../Select/Select';
import { fieldReducers } from '@grafana/data';
var StatsPicker = /** @class */ (function (_super) {
    __extends(StatsPicker, _super);
    function StatsPicker() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.checkInput = function () {
            var _a = _this.props, stats = _a.stats, allowMultiple = _a.allowMultiple, defaultStat = _a.defaultStat, onChange = _a.onChange;
            var current = fieldReducers.list(stats);
            if (current.length !== stats.length) {
                var found = current.map(function (v) { return v.id; });
                var notFound = difference(stats, found);
                console.warn('Unknown stats', notFound, stats);
                onChange(current.map(function (stat) { return stat.id; }));
            }
            // Make sure there is only one
            if (!allowMultiple && stats.length > 1) {
                console.warn('Removing extra stat', stats);
                onChange([stats[0]]);
            }
            // Set the reducer from callback
            if (defaultStat && stats.length < 1) {
                onChange([defaultStat]);
            }
        };
        _this.onSelectionChange = function (item) {
            var onChange = _this.props.onChange;
            if (Array.isArray(item)) {
                onChange(item.map(function (v) { return v.value; }));
            }
            else {
                onChange(item && item.value ? [item.value] : []);
            }
        };
        return _this;
    }
    StatsPicker.prototype.componentDidMount = function () {
        this.checkInput();
    };
    StatsPicker.prototype.componentDidUpdate = function (prevProps) {
        this.checkInput();
    };
    StatsPicker.prototype.render = function () {
        var _a = this.props, stats = _a.stats, allowMultiple = _a.allowMultiple, defaultStat = _a.defaultStat, placeholder = _a.placeholder, className = _a.className, menuPlacement = _a.menuPlacement, width = _a.width, inputId = _a.inputId;
        var select = fieldReducers.selectOptions(stats);
        return (React.createElement(Select, { menuShouldPortal: true, value: select.current, className: className, isClearable: !defaultStat, isMulti: allowMultiple, width: width, isSearchable: true, options: select.options, placeholder: placeholder, onChange: this.onSelectionChange, menuPlacement: menuPlacement, inputId: inputId }));
    };
    StatsPicker.defaultProps = {
        allowMultiple: false,
    };
    return StatsPicker;
}(PureComponent));
export { StatsPicker };
//# sourceMappingURL=StatsPicker.js.map
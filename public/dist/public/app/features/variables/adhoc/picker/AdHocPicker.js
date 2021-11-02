import { __assign, __extends } from "tslib";
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { AdHocFilterBuilder } from './AdHocFilterBuilder';
import { ConditionSegment } from './ConditionSegment';
import { addFilter, changeFilter, removeFilter } from '../actions';
import { REMOVE_FILTER_KEY } from './AdHocFilterKey';
import { AdHocFilterRenderer } from './AdHocFilterRenderer';
var mapDispatchToProps = {
    addFilter: addFilter,
    removeFilter: removeFilter,
    changeFilter: changeFilter,
};
var connector = connect(null, mapDispatchToProps);
var AdHocPickerUnconnected = /** @class */ (function (_super) {
    __extends(AdHocPickerUnconnected, _super);
    function AdHocPickerUnconnected() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.onChange = function (index, prop) { return function (key) {
            var _a;
            var _b = _this.props.variable, id = _b.id, filters = _b.filters;
            var value = key.value;
            if (key.value === REMOVE_FILTER_KEY) {
                return _this.props.removeFilter(id, index);
            }
            return _this.props.changeFilter(id, {
                index: index,
                filter: __assign(__assign({}, filters[index]), (_a = {}, _a[prop] = value, _a)),
            });
        }; };
        _this.appendFilterToVariable = function (filter) {
            var id = _this.props.variable.id;
            _this.props.addFilter(id, filter);
        };
        return _this;
    }
    AdHocPickerUnconnected.prototype.render = function () {
        var filters = this.props.variable.filters;
        return (React.createElement("div", { className: "gf-form-inline" },
            this.renderFilters(filters),
            React.createElement(AdHocFilterBuilder, { datasource: this.props.variable.datasource, appendBefore: filters.length > 0 ? React.createElement(ConditionSegment, { label: "AND" }) : null, onCompleted: this.appendFilterToVariable })));
    };
    AdHocPickerUnconnected.prototype.renderFilters = function (filters) {
        var _this = this;
        return filters.reduce(function (segments, filter, index) {
            if (segments.length > 0) {
                segments.push(React.createElement(ConditionSegment, { label: "AND", key: "condition-" + index }));
            }
            segments.push(_this.renderFilterSegments(filter, index));
            return segments;
        }, []);
    };
    AdHocPickerUnconnected.prototype.renderFilterSegments = function (filter, index) {
        return (React.createElement(React.Fragment, { key: "filter-" + index },
            React.createElement(AdHocFilterRenderer, { datasource: this.props.variable.datasource, filter: filter, onKeyChange: this.onChange(index, 'key'), onOperatorChange: this.onChange(index, 'operator'), onValueChange: this.onChange(index, 'value') })));
    };
    return AdHocPickerUnconnected;
}(PureComponent));
export { AdHocPickerUnconnected };
export var AdHocPicker = connector(AdHocPickerUnconnected);
AdHocPicker.displayName = 'AdHocPicker';
//# sourceMappingURL=AdHocPicker.js.map
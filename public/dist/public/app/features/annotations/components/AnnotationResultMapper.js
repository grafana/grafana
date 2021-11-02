import { __assign, __extends, __read, __spreadArray } from "tslib";
import React, { PureComponent } from 'react';
import { getFieldDisplayName, formattedValueToString, AnnotationEventFieldSource, getValueFormat, } from '@grafana/data';
import { annotationEventNames } from '../standardAnnotationSupport';
import { Select, Tooltip, Icon } from '@grafana/ui';
var AnnotationFieldMapper = /** @class */ (function (_super) {
    __extends(AnnotationFieldMapper, _super);
    function AnnotationFieldMapper(props) {
        var _this = _super.call(this, props) || this;
        _this.updateFields = function () {
            var _a, _b;
            var frame = (_b = (_a = _this.props.response) === null || _a === void 0 ? void 0 : _a.panelData) === null || _b === void 0 ? void 0 : _b.series[0];
            if (frame && frame.fields) {
                var fieldNames = frame.fields.map(function (f) {
                    var name = getFieldDisplayName(f, frame);
                    var description = '';
                    for (var i = 0; i < frame.length; i++) {
                        if (i > 0) {
                            description += ', ';
                        }
                        if (i > 2) {
                            description += '...';
                            break;
                        }
                        description += f.values.get(i);
                    }
                    if (description.length > 50) {
                        description = description.substring(0, 50) + '...';
                    }
                    return {
                        label: name + " (" + f.type + ")",
                        value: name,
                        description: description,
                    };
                });
                _this.setState({ fieldNames: fieldNames });
            }
        };
        _this.onFieldSourceChange = function (k, v) {
            var _a;
            var mappings = _this.props.mappings || {};
            var mapping = mappings[k] || {};
            _this.props.change(__assign(__assign({}, mappings), (_a = {}, _a[k] = __assign(__assign({}, mapping), { source: v.value || AnnotationEventFieldSource.Field }), _a)));
        };
        _this.onFieldNameChange = function (k, v) {
            var _a;
            var mappings = _this.props.mappings || {};
            var mapping = mappings[k] || {};
            _this.props.change(__assign(__assign({}, mappings), (_a = {}, _a[k] = __assign(__assign({}, mapping), { value: v.value, source: AnnotationEventFieldSource.Field }), _a)));
        };
        _this.state = {
            fieldNames: [],
        };
        return _this;
    }
    AnnotationFieldMapper.prototype.componentDidMount = function () {
        this.updateFields();
    };
    AnnotationFieldMapper.prototype.componentDidUpdate = function (oldProps) {
        if (oldProps.response !== this.props.response) {
            this.updateFields();
        }
    };
    AnnotationFieldMapper.prototype.renderRow = function (row, mapping, first) {
        var _this = this;
        var fieldNames = this.state.fieldNames;
        var picker = fieldNames;
        var current = mapping.value;
        var currentValue = fieldNames.find(function (f) { return current === f.value; });
        if (current) {
            picker = __spreadArray([], __read(fieldNames), false);
            if (!currentValue) {
                picker.push({
                    label: current,
                    value: current,
                });
            }
        }
        var value = first ? first[row.key] : '';
        if (value && row.key.startsWith('time')) {
            var fmt = getValueFormat('dateTimeAsIso');
            value = formattedValueToString(fmt(value));
        }
        if (value === null || value === undefined) {
            value = ''; // empty string
        }
        return (React.createElement("tr", { key: row.key },
            React.createElement("td", null,
                row.key,
                ' ',
                row.help && (React.createElement(Tooltip, { content: row.help },
                    React.createElement(Icon, { name: "info-circle" })))),
            React.createElement("td", null,
                React.createElement(Select, { menuShouldPortal: true, value: currentValue, options: picker, placeholder: row.placeholder || row.key, onChange: function (v) {
                        _this.onFieldNameChange(row.key, v);
                    }, noOptionsMessage: "Unknown field names", allowCustomValue: true })),
            React.createElement("td", null, "" + value)));
    };
    AnnotationFieldMapper.prototype.render = function () {
        var _this = this;
        var _a, _b;
        var first = (_b = (_a = this.props.response) === null || _a === void 0 ? void 0 : _a.events) === null || _b === void 0 ? void 0 : _b[0];
        var mappings = this.props.mappings || {};
        return (React.createElement("table", { className: "filter-table" },
            React.createElement("thead", null,
                React.createElement("tr", null,
                    React.createElement("th", null, "Annotation"),
                    React.createElement("th", null, "From"),
                    React.createElement("th", null, "First Value"))),
            React.createElement("tbody", null, annotationEventNames.map(function (row) {
                return _this.renderRow(row, mappings[row.key] || {}, first);
            }))));
    };
    return AnnotationFieldMapper;
}(PureComponent));
export { AnnotationFieldMapper };
//# sourceMappingURL=AnnotationResultMapper.js.map
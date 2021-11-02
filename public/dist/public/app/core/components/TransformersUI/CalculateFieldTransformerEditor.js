import { __assign, __extends, __read, __spreadArray, __values } from "tslib";
import React from 'react';
import { of } from 'rxjs';
import { map } from 'rxjs/operators';
import { binaryOperators, DataTransformerID, FieldType, getFieldDisplayName, ReducerID, standardTransformers, } from '@grafana/data';
import { FilterPill, HorizontalGroup, Input, LegacyForms, Select, StatsPicker } from '@grafana/ui';
import { CalculateFieldMode, getNameFromOptions, } from '@grafana/data/src/transformations/transformers/calculateField';
import { defaults } from 'lodash';
var calculationModes = [
    { value: CalculateFieldMode.BinaryOperation, label: 'Binary operation' },
    { value: CalculateFieldMode.ReduceRow, label: 'Reduce row' },
];
var okTypes = new Set([FieldType.time, FieldType.number, FieldType.string]);
var CalculateFieldTransformerEditor = /** @class */ (function (_super) {
    __extends(CalculateFieldTransformerEditor, _super);
    function CalculateFieldTransformerEditor(props) {
        var _a, _b;
        var _this = _super.call(this, props) || this;
        _this.onToggleReplaceFields = function () {
            var options = _this.props.options;
            _this.props.onChange(__assign(__assign({}, options), { replaceFields: !options.replaceFields }));
        };
        _this.onModeChanged = function (value) {
            var _a;
            var _b = _this.props, options = _b.options, onChange = _b.onChange;
            var mode = (_a = value.value) !== null && _a !== void 0 ? _a : CalculateFieldMode.BinaryOperation;
            onChange(__assign(__assign({}, options), { mode: mode }));
        };
        _this.onAliasChanged = function (evt) {
            var options = _this.props.options;
            _this.props.onChange(__assign(__assign({}, options), { alias: evt.target.value }));
        };
        //---------------------------------------------------------
        // Reduce by Row
        //---------------------------------------------------------
        _this.updateReduceOptions = function (v) {
            var _a = _this.props, options = _a.options, onChange = _a.onChange;
            onChange(__assign(__assign({}, options), { mode: CalculateFieldMode.ReduceRow, reduce: v }));
        };
        _this.onFieldToggle = function (fieldName) {
            var selected = _this.state.selected;
            if (selected.indexOf(fieldName) > -1) {
                _this.onChange(selected.filter(function (s) { return s !== fieldName; }));
            }
            else {
                _this.onChange(__spreadArray(__spreadArray([], __read(selected), false), [fieldName], false));
            }
        };
        _this.onChange = function (selected) {
            _this.setState({ selected: selected });
            var reduce = _this.props.options.reduce;
            _this.updateReduceOptions(__assign(__assign({}, reduce), { include: selected }));
        };
        _this.onStatsChange = function (stats) {
            var reducer = stats.length ? stats[0] : ReducerID.sum;
            var reduce = _this.props.options.reduce;
            _this.updateReduceOptions(__assign(__assign({}, reduce), { reducer: reducer }));
        };
        //---------------------------------------------------------
        // Binary Operator
        //---------------------------------------------------------
        _this.updateBinaryOptions = function (v) {
            var _a = _this.props, options = _a.options, onChange = _a.onChange;
            onChange(__assign(__assign({}, options), { mode: CalculateFieldMode.BinaryOperation, binary: v }));
        };
        _this.onBinaryLeftChanged = function (v) {
            var binary = _this.props.options.binary;
            _this.updateBinaryOptions(__assign(__assign({}, binary), { left: v.value }));
        };
        _this.onBinaryRightChanged = function (v) {
            var binary = _this.props.options.binary;
            _this.updateBinaryOptions(__assign(__assign({}, binary), { right: v.value }));
        };
        _this.onBinaryOperationChanged = function (v) {
            var binary = _this.props.options.binary;
            _this.updateBinaryOptions(__assign(__assign({}, binary), { operator: v.value }));
        };
        _this.state = {
            include: ((_b = (_a = props.options) === null || _a === void 0 ? void 0 : _a.reduce) === null || _b === void 0 ? void 0 : _b.include) || [],
            names: [],
            selected: [],
        };
        return _this;
    }
    CalculateFieldTransformerEditor.prototype.componentDidMount = function () {
        this.initOptions();
    };
    CalculateFieldTransformerEditor.prototype.componentDidUpdate = function (oldProps) {
        if (this.props.input !== oldProps.input) {
            this.initOptions();
        }
    };
    CalculateFieldTransformerEditor.prototype.initOptions = function () {
        var _this = this;
        var _a;
        var options = this.props.options;
        var configuredOptions = ((_a = options === null || options === void 0 ? void 0 : options.reduce) === null || _a === void 0 ? void 0 : _a.include) || [];
        var subscription = of(this.props.input)
            .pipe(standardTransformers.ensureColumnsTransformer.operator(null), this.extractAllNames(), this.extractNamesAndSelected(configuredOptions))
            .subscribe(function (_a) {
            var selected = _a.selected, names = _a.names;
            _this.setState({ names: names, selected: selected }, function () { return subscription.unsubscribe(); });
        });
    };
    CalculateFieldTransformerEditor.prototype.extractAllNames = function () {
        return function (source) {
            return source.pipe(map(function (input) {
                var e_1, _a, e_2, _b;
                var allNames = [];
                var byName = {};
                try {
                    for (var input_1 = __values(input), input_1_1 = input_1.next(); !input_1_1.done; input_1_1 = input_1.next()) {
                        var frame = input_1_1.value;
                        try {
                            for (var _c = (e_2 = void 0, __values(frame.fields)), _d = _c.next(); !_d.done; _d = _c.next()) {
                                var field = _d.value;
                                if (!okTypes.has(field.type)) {
                                    continue;
                                }
                                var displayName = getFieldDisplayName(field, frame, input);
                                if (!byName[displayName]) {
                                    byName[displayName] = true;
                                    allNames.push(displayName);
                                }
                            }
                        }
                        catch (e_2_1) { e_2 = { error: e_2_1 }; }
                        finally {
                            try {
                                if (_d && !_d.done && (_b = _c.return)) _b.call(_c);
                            }
                            finally { if (e_2) throw e_2.error; }
                        }
                    }
                }
                catch (e_1_1) { e_1 = { error: e_1_1 }; }
                finally {
                    try {
                        if (input_1_1 && !input_1_1.done && (_a = input_1.return)) _a.call(input_1);
                    }
                    finally { if (e_1) throw e_1.error; }
                }
                return allNames;
            }));
        };
    };
    CalculateFieldTransformerEditor.prototype.extractNamesAndSelected = function (configuredOptions) {
        return function (source) {
            return source.pipe(map(function (allNames) {
                var e_3, _a;
                if (!configuredOptions.length) {
                    return { names: allNames, selected: [] };
                }
                var names = [];
                var selected = [];
                try {
                    for (var allNames_1 = __values(allNames), allNames_1_1 = allNames_1.next(); !allNames_1_1.done; allNames_1_1 = allNames_1.next()) {
                        var v = allNames_1_1.value;
                        if (configuredOptions.includes(v)) {
                            selected.push(v);
                        }
                        names.push(v);
                    }
                }
                catch (e_3_1) { e_3 = { error: e_3_1 }; }
                finally {
                    try {
                        if (allNames_1_1 && !allNames_1_1.done && (_a = allNames_1.return)) _a.call(allNames_1);
                    }
                    finally { if (e_3) throw e_3.error; }
                }
                return { names: names, selected: selected };
            }));
        };
    };
    CalculateFieldTransformerEditor.prototype.renderReduceRow = function (options) {
        var _this = this;
        var _a = this.state, names = _a.names, selected = _a.selected;
        options = defaults(options, { reducer: ReducerID.sum });
        return (React.createElement(React.Fragment, null,
            React.createElement("div", { className: "gf-form-inline" },
                React.createElement("div", { className: "gf-form gf-form--grow" },
                    React.createElement("div", { className: "gf-form-label width-8" }, "Field name"),
                    React.createElement(HorizontalGroup, { spacing: "xs", align: "flex-start", wrap: true }, names.map(function (o, i) {
                        return (React.createElement(FilterPill, { key: o + "/" + i, onClick: function () {
                                _this.onFieldToggle(o);
                            }, label: o, selected: selected.indexOf(o) > -1 }));
                    })))),
            React.createElement("div", { className: "gf-form-inline" },
                React.createElement("div", { className: "gf-form" },
                    React.createElement("div", { className: "gf-form-label width-8" }, "Calculation"),
                    React.createElement(StatsPicker, { allowMultiple: false, className: "width-18", stats: [options.reducer], onChange: this.onStatsChange, defaultStat: ReducerID.sum })))));
    };
    CalculateFieldTransformerEditor.prototype.renderBinaryOperation = function (options) {
        var _a;
        options = defaults(options, { reducer: ReducerID.sum });
        var foundLeft = !(options === null || options === void 0 ? void 0 : options.left);
        var foundRight = !(options === null || options === void 0 ? void 0 : options.right);
        var names = this.state.names.map(function (v) {
            if (v === (options === null || options === void 0 ? void 0 : options.left)) {
                foundLeft = true;
            }
            if (v === (options === null || options === void 0 ? void 0 : options.right)) {
                foundRight = true;
            }
            return { label: v, value: v };
        });
        var leftNames = foundLeft ? names : __spreadArray(__spreadArray([], __read(names), false), [{ label: options === null || options === void 0 ? void 0 : options.left, value: options === null || options === void 0 ? void 0 : options.left }], false);
        var rightNames = foundRight ? names : __spreadArray(__spreadArray([], __read(names), false), [{ label: options === null || options === void 0 ? void 0 : options.right, value: options === null || options === void 0 ? void 0 : options.right }], false);
        var ops = binaryOperators.list().map(function (v) {
            return { label: v.id, value: v.id };
        });
        return (React.createElement("div", { className: "gf-form-inline" },
            React.createElement("div", { className: "gf-form" },
                React.createElement("div", { className: "gf-form-label width-8" }, "Operation")),
            React.createElement("div", { className: "gf-form" },
                React.createElement(Select, { menuShouldPortal: true, allowCustomValue: true, placeholder: "Field or number", options: leftNames, className: "min-width-18 gf-form-spacing", value: options === null || options === void 0 ? void 0 : options.left, onChange: this.onBinaryLeftChanged }),
                React.createElement(Select, { menuShouldPortal: true, className: "width-8 gf-form-spacing", options: ops, value: (_a = options.operator) !== null && _a !== void 0 ? _a : ops[0].value, onChange: this.onBinaryOperationChanged }),
                React.createElement(Select, { menuShouldPortal: true, allowCustomValue: true, placeholder: "Field or number", className: "min-width-10", options: rightNames, value: options === null || options === void 0 ? void 0 : options.right, onChange: this.onBinaryRightChanged }))));
    };
    //---------------------------------------------------------
    // Render
    //---------------------------------------------------------
    CalculateFieldTransformerEditor.prototype.render = function () {
        var _a, _b;
        var options = this.props.options;
        var mode = (_a = options.mode) !== null && _a !== void 0 ? _a : CalculateFieldMode.BinaryOperation;
        return (React.createElement("div", null,
            React.createElement("div", { className: "gf-form-inline" },
                React.createElement("div", { className: "gf-form" },
                    React.createElement("div", { className: "gf-form-label width-8" }, "Mode"),
                    React.createElement(Select, { menuShouldPortal: true, className: "width-18", options: calculationModes, value: calculationModes.find(function (v) { return v.value === mode; }), onChange: this.onModeChanged }))),
            mode === CalculateFieldMode.BinaryOperation && this.renderBinaryOperation(options.binary),
            mode === CalculateFieldMode.ReduceRow && this.renderReduceRow(options.reduce),
            React.createElement("div", { className: "gf-form-inline" },
                React.createElement("div", { className: "gf-form" },
                    React.createElement("div", { className: "gf-form-label width-8" }, "Alias"),
                    React.createElement(Input, { className: "width-18", value: (_b = options.alias) !== null && _b !== void 0 ? _b : '', placeholder: getNameFromOptions(options), onChange: this.onAliasChanged }))),
            React.createElement("div", { className: "gf-form-inline" },
                React.createElement("div", { className: "gf-form" },
                    React.createElement(LegacyForms.Switch, { label: "Replace all fields", labelClass: "width-8", checked: !!options.replaceFields, onChange: this.onToggleReplaceFields })))));
    };
    return CalculateFieldTransformerEditor;
}(React.PureComponent));
export { CalculateFieldTransformerEditor };
export var calculateFieldTransformRegistryItem = {
    id: DataTransformerID.calculateField,
    editor: CalculateFieldTransformerEditor,
    transformation: standardTransformers.calculateFieldTransformer,
    name: 'Add field from calculation',
    description: 'Use the row values to calculate a new field',
};
//# sourceMappingURL=CalculateFieldTransformerEditor.js.map
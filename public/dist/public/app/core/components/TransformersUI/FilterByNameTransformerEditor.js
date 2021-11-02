import { __assign, __extends, __makeTemplateObject, __read, __spreadArray, __values } from "tslib";
import React from 'react';
import { DataTransformerID, standardTransformers, getFieldDisplayName, stringToJsRegex, } from '@grafana/data';
import { Field, Input, FilterPill, HorizontalGroup } from '@grafana/ui';
import { css } from '@emotion/css';
var FilterByNameTransformerEditor = /** @class */ (function (_super) {
    __extends(FilterByNameTransformerEditor, _super);
    function FilterByNameTransformerEditor(props) {
        var _a, _b;
        var _this = _super.call(this, props) || this;
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
            var _a;
            var _b = _this.state, regex = _b.regex, isRegexValid = _b.isRegexValid;
            var options = __assign(__assign({}, _this.props.options), { include: { names: selected } });
            if (regex && isRegexValid) {
                options.include = (_a = options.include) !== null && _a !== void 0 ? _a : {};
                options.include.pattern = regex;
            }
            _this.setState({ selected: selected }, function () {
                _this.props.onChange(options);
            });
        };
        _this.onInputBlur = function (e) {
            var _a = _this.state, selected = _a.selected, regex = _a.regex;
            var isRegexValid = true;
            try {
                if (regex) {
                    stringToJsRegex(regex);
                }
            }
            catch (e) {
                isRegexValid = false;
            }
            if (isRegexValid) {
                _this.props.onChange(__assign(__assign({}, _this.props.options), { include: { pattern: regex } }));
            }
            else {
                _this.props.onChange(__assign(__assign({}, _this.props.options), { include: { names: selected } }));
            }
            _this.setState({ isRegexValid: isRegexValid });
        };
        _this.state = {
            include: ((_a = props.options.include) === null || _a === void 0 ? void 0 : _a.names) || [],
            regex: (_b = props.options.include) === null || _b === void 0 ? void 0 : _b.pattern,
            options: [],
            selected: [],
            isRegexValid: true,
        };
        return _this;
    }
    FilterByNameTransformerEditor.prototype.componentDidMount = function () {
        this.initOptions();
    };
    FilterByNameTransformerEditor.prototype.componentDidUpdate = function (oldProps) {
        if (this.props.input !== oldProps.input) {
            this.initOptions();
        }
    };
    FilterByNameTransformerEditor.prototype.initOptions = function () {
        var e_1, _a, e_2, _b, e_3, _c;
        var _d, _e, _f, _g, _h;
        var _j = this.props, input = _j.input, options = _j.options;
        var configuredOptions = Array.from((_e = (_d = options.include) === null || _d === void 0 ? void 0 : _d.names) !== null && _e !== void 0 ? _e : []);
        var allNames = [];
        var byName = {};
        try {
            for (var input_1 = __values(input), input_1_1 = input_1.next(); !input_1_1.done; input_1_1 = input_1.next()) {
                var frame = input_1_1.value;
                try {
                    for (var _k = (e_2 = void 0, __values(frame.fields)), _l = _k.next(); !_l.done; _l = _k.next()) {
                        var field = _l.value;
                        var displayName = getFieldDisplayName(field, frame, input);
                        var v = byName[displayName];
                        if (!v) {
                            v = byName[displayName] = {
                                name: displayName,
                                count: 0,
                            };
                            allNames.push(v);
                        }
                        v.count++;
                    }
                }
                catch (e_2_1) { e_2 = { error: e_2_1 }; }
                finally {
                    try {
                        if (_l && !_l.done && (_b = _k.return)) _b.call(_k);
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
        if ((_f = options.include) === null || _f === void 0 ? void 0 : _f.pattern) {
            try {
                var regex = stringToJsRegex(options.include.pattern);
                try {
                    for (var allNames_1 = __values(allNames), allNames_1_1 = allNames_1.next(); !allNames_1_1.done; allNames_1_1 = allNames_1.next()) {
                        var info = allNames_1_1.value;
                        if (regex.test(info.name)) {
                            configuredOptions.push(info.name);
                        }
                    }
                }
                catch (e_3_1) { e_3 = { error: e_3_1 }; }
                finally {
                    try {
                        if (allNames_1_1 && !allNames_1_1.done && (_c = allNames_1.return)) _c.call(allNames_1);
                    }
                    finally { if (e_3) throw e_3.error; }
                }
            }
            catch (error) {
                console.error(error);
            }
        }
        if (configuredOptions.length) {
            var selected = allNames.filter(function (n) { return configuredOptions.includes(n.name); });
            this.setState({
                options: allNames,
                selected: selected.map(function (s) { return s.name; }),
                regex: (_g = options.include) === null || _g === void 0 ? void 0 : _g.pattern,
            });
        }
        else {
            this.setState({
                options: allNames,
                selected: allNames.map(function (n) { return n.name; }),
                regex: (_h = options.include) === null || _h === void 0 ? void 0 : _h.pattern,
            });
        }
    };
    FilterByNameTransformerEditor.prototype.render = function () {
        var _this = this;
        var _a = this.state, options = _a.options, selected = _a.selected, isRegexValid = _a.isRegexValid;
        return (React.createElement("div", { className: "gf-form-inline" },
            React.createElement("div", { className: "gf-form gf-form--grow" },
                React.createElement("div", { className: "gf-form-label width-8" }, "Identifier"),
                React.createElement(HorizontalGroup, { spacing: "xs", align: "flex-start", wrap: true },
                    React.createElement(Field, { invalid: !isRegexValid, error: !isRegexValid ? 'Invalid pattern' : undefined, className: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n                margin-bottom: 0;\n              "], ["\n                margin-bottom: 0;\n              "]))) },
                        React.createElement(Input, { placeholder: "Regular expression pattern", value: this.state.regex || '', onChange: function (e) { return _this.setState({ regex: e.currentTarget.value }); }, onBlur: this.onInputBlur, width: 25 })),
                    options.map(function (o, i) {
                        var label = "" + o.name + (o.count > 1 ? ' (' + o.count + ')' : '');
                        var isSelected = selected.indexOf(o.name) > -1;
                        return (React.createElement(FilterPill, { key: o.name + "/" + i, onClick: function () {
                                _this.onFieldToggle(o.name);
                            }, label: label, selected: isSelected }));
                    })))));
    };
    return FilterByNameTransformerEditor;
}(React.PureComponent));
export { FilterByNameTransformerEditor };
export var filterFieldsByNameTransformRegistryItem = {
    id: DataTransformerID.filterFieldsByName,
    editor: FilterByNameTransformerEditor,
    transformation: standardTransformers.filterFieldsByNameTransformer,
    name: 'Filter by name',
    description: 'Removes part of the query results using a regex pattern. The pattern can be inclusive or exclusive.',
};
var templateObject_1;
//# sourceMappingURL=FilterByNameTransformerEditor.js.map
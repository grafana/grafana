import { __assign, __extends, __read, __spreadArray, __values } from "tslib";
import React from 'react';
import { DataTransformerID, standardTransformers, } from '@grafana/data';
import { HorizontalGroup, FilterPill } from '@grafana/ui';
var FilterByRefIdTransformerEditor = /** @class */ (function (_super) {
    __extends(FilterByRefIdTransformerEditor, _super);
    function FilterByRefIdTransformerEditor(props) {
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
            _this.setState({ selected: selected });
            _this.props.onChange(__assign(__assign({}, _this.props.options), { include: selected.join('|') }));
        };
        _this.state = {
            include: props.options.include || '',
            options: [],
            selected: [],
        };
        return _this;
    }
    FilterByRefIdTransformerEditor.prototype.componentDidMount = function () {
        this.initOptions();
    };
    FilterByRefIdTransformerEditor.prototype.componentDidUpdate = function (oldProps) {
        if (this.props.input !== oldProps.input) {
            this.initOptions();
        }
    };
    FilterByRefIdTransformerEditor.prototype.initOptions = function () {
        var e_1, _a, e_2, _b;
        var _c = this.props, input = _c.input, options = _c.options;
        var configuredOptions = options.include ? options.include.split('|') : [];
        var allNames = [];
        var byName = {};
        try {
            for (var input_1 = __values(input), input_1_1 = input_1.next(); !input_1_1.done; input_1_1 = input_1.next()) {
                var frame = input_1_1.value;
                if (frame.refId) {
                    var v = byName[frame.refId];
                    if (!v) {
                        v = byName[frame.refId] = {
                            refId: frame.refId,
                            count: 0,
                        };
                        allNames.push(v);
                    }
                    v.count++;
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
        if (configuredOptions.length) {
            var options_1 = [];
            var selected = [];
            try {
                for (var allNames_1 = __values(allNames), allNames_1_1 = allNames_1.next(); !allNames_1_1.done; allNames_1_1 = allNames_1.next()) {
                    var v = allNames_1_1.value;
                    if (configuredOptions.includes(v.refId)) {
                        selected.push(v);
                    }
                    options_1.push(v);
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (allNames_1_1 && !allNames_1_1.done && (_b = allNames_1.return)) _b.call(allNames_1);
                }
                finally { if (e_2) throw e_2.error; }
            }
            this.setState({
                options: options_1,
                selected: selected.map(function (s) { return s.refId; }),
            });
        }
        else {
            this.setState({ options: allNames, selected: [] });
        }
    };
    FilterByRefIdTransformerEditor.prototype.render = function () {
        var _this = this;
        var _a = this.state, options = _a.options, selected = _a.selected;
        return (React.createElement("div", { className: "gf-form-inline" },
            React.createElement("div", { className: "gf-form gf-form--grow" },
                React.createElement("div", { className: "gf-form-label width-8" }, "Series refId"),
                React.createElement(HorizontalGroup, { spacing: "xs", align: "flex-start", wrap: true }, options.map(function (o, i) {
                    var label = "" + o.refId + (o.count > 1 ? ' (' + o.count + ')' : '');
                    var isSelected = selected.indexOf(o.refId) > -1;
                    return (React.createElement(FilterPill, { key: o.refId + "/" + i, onClick: function () {
                            _this.onFieldToggle(o.refId);
                        }, label: label, selected: isSelected }));
                })))));
    };
    return FilterByRefIdTransformerEditor;
}(React.PureComponent));
export { FilterByRefIdTransformerEditor };
export var filterFramesByRefIdTransformRegistryItem = {
    id: DataTransformerID.filterByRefId,
    editor: FilterByRefIdTransformerEditor,
    transformation: standardTransformers.filterFramesByRefIdTransformer,
    name: 'Filter data by query',
    description: 'Filter data by query. This is useful if you are sharing the results from a different panel that has many queries and you want to only visualize a subset of that in this panel.',
};
//# sourceMappingURL=FilterByRefIdTransformerEditor.js.map
import { __extends } from "tslib";
import React, { PureComponent } from 'react';
import { InlineFormLabel, TextArea } from '@grafana/ui';
import { FluxQueryEditor } from './FluxQueryEditor';
var VariableQueryEditor = /** @class */ (function (_super) {
    __extends(VariableQueryEditor, _super);
    function VariableQueryEditor() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.onRefresh = function () {
            // noop
        };
        return _this;
    }
    VariableQueryEditor.prototype.render = function () {
        var _a = this.props, query = _a.query, datasource = _a.datasource, onChange = _a.onChange;
        if (datasource.isFlux) {
            return (React.createElement(FluxQueryEditor, { datasource: datasource, query: {
                    refId: 'A',
                    query: query,
                }, onRunQuery: this.onRefresh, onChange: function (v) { return onChange(v.query); } }));
        }
        return (React.createElement("div", { className: "gf-form-inline" },
            React.createElement(InlineFormLabel, { width: 10 }, "Query"),
            React.createElement("div", { className: "gf-form-inline gf-form--grow" },
                React.createElement(TextArea, { defaultValue: query || '', placeholder: "metric name or tags query", rows: 1, className: "gf-form-input", onBlur: function (e) { return onChange(e.currentTarget.value); } }))));
    };
    return VariableQueryEditor;
}(PureComponent));
export default VariableQueryEditor;
//# sourceMappingURL=VariableQueryEditor.js.map
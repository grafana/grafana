import * as tslib_1 from "tslib";
import React, { PureComponent } from 'react';
// Types
import { Switch, FormField } from '@grafana/ui';
var TablePanelEditor = /** @class */ (function (_super) {
    tslib_1.__extends(TablePanelEditor, _super);
    function TablePanelEditor() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.onToggleShowHeader = function () {
            _this.props.onOptionsChange(tslib_1.__assign({}, _this.props.options, { showHeader: !_this.props.options.showHeader }));
        };
        _this.onToggleFixedHeader = function () {
            _this.props.onOptionsChange(tslib_1.__assign({}, _this.props.options, { fixedHeader: !_this.props.options.fixedHeader }));
        };
        _this.onToggleRotate = function () {
            _this.props.onOptionsChange(tslib_1.__assign({}, _this.props.options, { rotate: !_this.props.options.rotate }));
        };
        _this.onFixedColumnsChange = function (_a) {
            var target = _a.target;
            _this.props.onOptionsChange(tslib_1.__assign({}, _this.props.options, { fixedColumns: target.value }));
        };
        return _this;
    }
    TablePanelEditor.prototype.render = function () {
        var _a = this.props.options, showHeader = _a.showHeader, fixedHeader = _a.fixedHeader, rotate = _a.rotate, fixedColumns = _a.fixedColumns;
        return (React.createElement("div", null,
            React.createElement("div", { className: "section gf-form-group" },
                React.createElement("h5", { className: "section-heading" }, "Header"),
                React.createElement(Switch, { label: "Show", labelClass: "width-6", checked: showHeader, onChange: this.onToggleShowHeader }),
                React.createElement(Switch, { label: "Fixed", labelClass: "width-6", checked: fixedHeader, onChange: this.onToggleFixedHeader })),
            React.createElement("div", { className: "section gf-form-group" },
                React.createElement("h5", { className: "section-heading" }, "Display"),
                React.createElement(Switch, { label: "Rotate", labelClass: "width-8", checked: rotate, onChange: this.onToggleRotate }),
                React.createElement(FormField, { label: "Fixed Columns", labelWidth: 8, inputWidth: 4, type: "number", step: "1", min: "0", max: "100", onChange: this.onFixedColumnsChange, value: fixedColumns }))));
    };
    return TablePanelEditor;
}(PureComponent));
export { TablePanelEditor };
//# sourceMappingURL=TablePanelEditor.js.map
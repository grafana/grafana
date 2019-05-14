import * as tslib_1 from "tslib";
// Libraries
import React, { PureComponent } from 'react';
// Components
import { PanelOptionsGroup, Select } from '@grafana/ui';
var TextPanelEditor = /** @class */ (function (_super) {
    tslib_1.__extends(TextPanelEditor, _super);
    function TextPanelEditor() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.modes = [
            { value: 'markdown', label: 'Markdown' },
            { value: 'text', label: 'Text' },
            { value: 'html', label: 'HTML' },
        ];
        _this.onModeChange = function (item) { return _this.props.onOptionsChange(tslib_1.__assign({}, _this.props.options, { mode: item.value })); };
        _this.onContentChange = function (evt) {
            _this.props.onOptionsChange(tslib_1.__assign({}, _this.props.options, { content: event.target.value }));
        };
        return _this;
    }
    TextPanelEditor.prototype.render = function () {
        var _a = this.props.options, mode = _a.mode, content = _a.content;
        return (React.createElement(PanelOptionsGroup, { title: "Text" },
            React.createElement("div", { className: "gf-form-inline" },
                React.createElement("div", { className: "gf-form" },
                    React.createElement("span", { className: "gf-form-label" }, "Mode"),
                    React.createElement(Select, { onChange: this.onModeChange, value: this.modes.find(function (e) { return mode === e.value; }), options: this.modes }))),
            React.createElement("textarea", { value: content, onChange: this.onContentChange, className: "gf-form-input", rows: 10 })));
    };
    return TextPanelEditor;
}(PureComponent));
export { TextPanelEditor };
//# sourceMappingURL=TextPanelEditor.js.map
import { __assign, __extends, __makeTemplateObject } from "tslib";
import React from 'react';
import { DataTransformerID, standardTransformers, stringToJsRegex, } from '@grafana/data';
import { Field, Input } from '@grafana/ui';
import { css } from '@emotion/css';
var RenameByRegexTransformerEditor = /** @class */ (function (_super) {
    __extends(RenameByRegexTransformerEditor, _super);
    function RenameByRegexTransformerEditor(props) {
        var _this = _super.call(this, props) || this;
        _this.handleRegexChange = function (e) {
            var regex = e.currentTarget.value;
            var isRegexValid = true;
            if (regex) {
                try {
                    if (regex) {
                        stringToJsRegex(regex);
                    }
                }
                catch (e) {
                    isRegexValid = false;
                }
            }
            _this.setState(function (previous) { return (__assign(__assign({}, previous), { regex: regex, isRegexValid: isRegexValid })); });
        };
        _this.handleRenameChange = function (e) {
            var renamePattern = e.currentTarget.value;
            _this.setState(function (previous) { return (__assign(__assign({}, previous), { renamePattern: renamePattern })); });
        };
        _this.handleRegexBlur = function (e) {
            var regex = e.currentTarget.value;
            var isRegexValid = true;
            try {
                if (regex) {
                    stringToJsRegex(regex);
                }
            }
            catch (e) {
                isRegexValid = false;
            }
            _this.setState({ isRegexValid: isRegexValid }, function () {
                if (isRegexValid) {
                    _this.props.onChange(__assign(__assign({}, _this.props.options), { regex: regex }));
                }
            });
        };
        _this.handleRenameBlur = function (e) {
            var renamePattern = e.currentTarget.value;
            _this.setState({ renamePattern: renamePattern }, function () { return _this.props.onChange(__assign(__assign({}, _this.props.options), { renamePattern: renamePattern })); });
        };
        _this.state = {
            regex: props.options.regex,
            renamePattern: props.options.renamePattern,
            isRegexValid: true,
        };
        return _this;
    }
    RenameByRegexTransformerEditor.prototype.render = function () {
        var _a = this.state, regex = _a.regex, renamePattern = _a.renamePattern, isRegexValid = _a.isRegexValid;
        return (React.createElement(React.Fragment, null,
            React.createElement("div", { className: "gf-form-inline" },
                React.createElement("div", { className: "gf-form gf-form--grow" },
                    React.createElement("div", { className: "gf-form-label width-8" }, "Match"),
                    React.createElement(Field, { invalid: !isRegexValid, error: !isRegexValid ? 'Invalid pattern' : undefined, className: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n                margin-bottom: 0;\n              "], ["\n                margin-bottom: 0;\n              "]))) },
                        React.createElement(Input, { placeholder: "Regular expression pattern", value: regex || '', onChange: this.handleRegexChange, onBlur: this.handleRegexBlur, width: 25 })))),
            React.createElement("div", { className: "gf-form-inline" },
                React.createElement("div", { className: "gf-form gf-form--grow" },
                    React.createElement("div", { className: "gf-form-label width-8" }, "Replace"),
                    React.createElement(Field, { className: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n                margin-bottom: 0;\n              "], ["\n                margin-bottom: 0;\n              "]))) },
                        React.createElement(Input, { placeholder: "Replacement pattern", value: renamePattern || '', onChange: this.handleRenameChange, onBlur: this.handleRenameBlur, width: 25 }))))));
    };
    return RenameByRegexTransformerEditor;
}(React.PureComponent));
export { RenameByRegexTransformerEditor };
export var renameByRegexTransformRegistryItem = {
    id: DataTransformerID.renameByRegex,
    editor: RenameByRegexTransformerEditor,
    transformation: standardTransformers.renameByRegexTransformer,
    name: 'Rename by regex',
    description: 'Renames part of the query result by using regular expression with placeholders.',
};
var templateObject_1, templateObject_2;
//# sourceMappingURL=RenameByRegexTransformer.js.map
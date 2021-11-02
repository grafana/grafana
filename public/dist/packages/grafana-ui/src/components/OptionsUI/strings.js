import { __extends, __makeTemplateObject, __read, __spreadArray } from "tslib";
import React from 'react';
import { Input } from '../Input/Input';
import { Icon } from '../Icon/Icon';
import { stylesFactory, getTheme } from '../../themes';
import { css } from '@emotion/css';
import { Button } from '../Button';
var StringArrayEditor = /** @class */ (function (_super) {
    __extends(StringArrayEditor, _super);
    function StringArrayEditor() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.state = {
            showAdd: false,
        };
        _this.onRemoveString = function (index) {
            var _a = _this.props, value = _a.value, onChange = _a.onChange;
            var copy = __spreadArray([], __read(value), false);
            copy.splice(index, 1);
            onChange(copy);
        };
        _this.onValueChange = function (e, idx) {
            var evt = e;
            if (e.hasOwnProperty('key')) {
                if (evt.key !== 'Enter') {
                    return;
                }
            }
            var _a = _this.props, value = _a.value, onChange = _a.onChange;
            // Form event, or Enter
            var v = evt.currentTarget.value.trim();
            if (idx < 0) {
                if (v) {
                    evt.currentTarget.value = ''; // reset last value
                    onChange(__spreadArray(__spreadArray([], __read(value), false), [v], false));
                }
                _this.setState({ showAdd: false });
                return;
            }
            if (!v) {
                return _this.onRemoveString(idx);
            }
            var copy = __spreadArray([], __read(value), false);
            copy[idx] = v;
            onChange(copy);
        };
        return _this;
    }
    StringArrayEditor.prototype.render = function () {
        var _this = this;
        var _a;
        var _b = this.props, value = _b.value, item = _b.item;
        var showAdd = this.state.showAdd;
        var styles = getStyles(getTheme());
        var placeholder = ((_a = item.settings) === null || _a === void 0 ? void 0 : _a.placeholder) || 'Add text';
        return (React.createElement("div", null,
            value.map(function (v, index) {
                return (React.createElement(Input, { className: styles.textInput, key: index + "/" + v, defaultValue: v || '', onBlur: function (e) { return _this.onValueChange(e, index); }, onKeyDown: function (e) { return _this.onValueChange(e, index); }, suffix: React.createElement(Icon, { className: styles.trashIcon, name: "trash-alt", onClick: function () { return _this.onRemoveString(index); } }) }));
            }),
            showAdd ? (React.createElement(Input, { autoFocus: true, className: styles.textInput, placeholder: placeholder, defaultValue: '', onBlur: function (e) { return _this.onValueChange(e, -1); }, onKeyDown: function (e) { return _this.onValueChange(e, -1); }, suffix: React.createElement(Icon, { name: "plus-circle" }) })) : (React.createElement(Button, { icon: "plus", size: "sm", variant: "secondary", onClick: function () { return _this.setState({ showAdd: true }); } }, placeholder))));
    };
    return StringArrayEditor;
}(React.PureComponent));
export { StringArrayEditor };
var getStyles = stylesFactory(function (theme) {
    return {
        textInput: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      margin-bottom: 5px;\n      &:hover {\n        border: 1px solid ", ";\n      }\n    "], ["\n      margin-bottom: 5px;\n      &:hover {\n        border: 1px solid ", ";\n      }\n    "])), theme.colors.formInputBorderHover),
        trashIcon: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      color: ", ";\n      cursor: pointer;\n\n      &:hover {\n        color: ", ";\n      }\n    "], ["\n      color: ", ";\n      cursor: pointer;\n\n      &:hover {\n        color: ", ";\n      }\n    "])), theme.colors.textWeak, theme.colors.text),
    };
});
var templateObject_1, templateObject_2;
//# sourceMappingURL=strings.js.map
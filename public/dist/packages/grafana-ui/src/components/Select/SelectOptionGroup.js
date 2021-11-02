import { __extends, __makeTemplateObject } from "tslib";
import React, { PureComponent } from 'react';
import { css } from '@emotion/css';
import { stylesFactory, withTheme } from '../../themes';
import { Icon } from '../Icon/Icon';
var getSelectOptionGroupStyles = stylesFactory(function (theme) {
    return {
        header: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      display: flex;\n      align-items: center;\n      justify-content: flex-start;\n      justify-items: center;\n      cursor: pointer;\n      padding: 7px 10px;\n      width: 100%;\n      border-bottom: 1px solid ", ";\n\n      &:hover {\n        color: ", ";\n      }\n    "], ["\n      display: flex;\n      align-items: center;\n      justify-content: flex-start;\n      justify-items: center;\n      cursor: pointer;\n      padding: 7px 10px;\n      width: 100%;\n      border-bottom: 1px solid ", ";\n\n      &:hover {\n        color: ", ";\n      }\n    "])), theme.colors.bg2, theme.colors.textStrong),
        label: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      flex-grow: 1;\n    "], ["\n      flex-grow: 1;\n    "]))),
        icon: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      padding-right: 2px;\n    "], ["\n      padding-right: 2px;\n    "]))),
    };
});
var UnthemedSelectOptionGroup = /** @class */ (function (_super) {
    __extends(UnthemedSelectOptionGroup, _super);
    function UnthemedSelectOptionGroup() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.state = {
            expanded: false,
        };
        _this.onToggleChildren = function () {
            _this.setState(function (prevState) { return ({
                expanded: !prevState.expanded,
            }); });
        };
        return _this;
    }
    UnthemedSelectOptionGroup.prototype.componentDidMount = function () {
        if (this.props.data.expanded) {
            this.setState({ expanded: true });
        }
        else if (this.props.selectProps && this.props.selectProps.value) {
            var value_1 = this.props.selectProps.value.value;
            if (value_1 && this.props.options.some(function (option) { return option.value === value_1; })) {
                this.setState({ expanded: true });
            }
        }
    };
    UnthemedSelectOptionGroup.prototype.componentDidUpdate = function (nextProps) {
        if (nextProps.selectProps.inputValue !== '') {
            this.setState({ expanded: true });
        }
    };
    UnthemedSelectOptionGroup.prototype.render = function () {
        var _a = this.props, children = _a.children, label = _a.label, theme = _a.theme;
        var expanded = this.state.expanded;
        var styles = getSelectOptionGroupStyles(theme);
        return (React.createElement("div", null,
            React.createElement("div", { className: styles.header, onClick: this.onToggleChildren },
                React.createElement("span", { className: styles.label }, label),
                React.createElement(Icon, { className: styles.icon, name: expanded ? 'angle-up' : 'angle-down' }),
                ' '),
            expanded && children));
    };
    return UnthemedSelectOptionGroup;
}(PureComponent));
export var SelectOptionGroup = withTheme(UnthemedSelectOptionGroup);
var templateObject_1, templateObject_2, templateObject_3;
//# sourceMappingURL=SelectOptionGroup.js.map
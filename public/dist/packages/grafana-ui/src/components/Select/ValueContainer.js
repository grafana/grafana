import { __extends, __read, __spreadArray } from "tslib";
import React from 'react';
import { cx } from '@emotion/css';
import { withTheme2 } from '../../themes/ThemeContext';
import { getSelectStyles } from './getSelectStyles';
var UnthemedValueContainer = /** @class */ (function (_super) {
    __extends(UnthemedValueContainer, _super);
    function UnthemedValueContainer() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    UnthemedValueContainer.prototype.render = function () {
        var children = this.props.children;
        var selectProps = this.props.selectProps;
        if (selectProps &&
            Array.isArray(children) &&
            Array.isArray(children[0]) &&
            selectProps.maxVisibleValues !== undefined &&
            !(selectProps.showAllSelectedWhenOpen && selectProps.menuIsOpen)) {
            var _a = __read(children), valueChildren = _a[0], otherChildren = _a.slice(1);
            var truncatedValues = valueChildren.slice(0, selectProps.maxVisibleValues);
            return this.renderContainer(__spreadArray([truncatedValues], __read(otherChildren), false));
        }
        return this.renderContainer(children);
    };
    UnthemedValueContainer.prototype.renderContainer = function (children) {
        var _a = this.props, isMulti = _a.isMulti, theme = _a.theme;
        var styles = getSelectStyles(theme);
        var className = cx(styles.valueContainer, isMulti && styles.valueContainerMulti);
        return React.createElement("div", { className: className }, children);
    };
    return UnthemedValueContainer;
}(React.Component));
export var ValueContainer = withTheme2(UnthemedValueContainer);
//# sourceMappingURL=ValueContainer.js.map
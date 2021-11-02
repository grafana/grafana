import { __extends, __makeTemplateObject } from "tslib";
import React from 'react';
import { cx, css } from '@emotion/css';
import { stylesFactory } from '../../themes';
var getStyles = stylesFactory(function (inlineList) {
    if (inlineList === void 0) { inlineList = false; }
    return ({
        list: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    list-style-type: none;\n    margin: 0;\n    padding: 0;\n  "], ["\n    list-style-type: none;\n    margin: 0;\n    padding: 0;\n  "]))),
        item: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    display: ", ";\n  "], ["\n    display: ", ";\n  "])), (inlineList && 'inline-block') || 'block'),
    });
});
var AbstractList = /** @class */ (function (_super) {
    __extends(AbstractList, _super);
    function AbstractList(props) {
        return _super.call(this, props) || this;
    }
    AbstractList.prototype.render = function () {
        var _a = this.props, items = _a.items, renderItem = _a.renderItem, getItemKey = _a.getItemKey, className = _a.className, inline = _a.inline;
        var styles = getStyles(inline);
        return (React.createElement("ul", { className: cx(styles.list, className) }, items.map(function (item, i) {
            return (React.createElement("li", { className: styles.item, key: getItemKey ? getItemKey(item) : i }, renderItem(item, i)));
        })));
    };
    return AbstractList;
}(React.PureComponent));
export { AbstractList };
var templateObject_1, templateObject_2;
//# sourceMappingURL=AbstractList.js.map